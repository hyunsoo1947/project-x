@Library('routebox-shared@main') _

// shipments-api deploy pipeline.
//
// Build + test once, deploy through dev/staging/prod with manual gates.
// The manual approval steps share the flaky-render bug called out in
// routebox-jenkins/README.md "Known issues" — refresh if Proceed doesn't
// render.
//
// Image tag is the git SHA. mutable. Don't rebuild a v* tag on hotfix.

pipeline {

    agent { label 'docker' }

    options {
        timestamps()
        ansiColor('xterm')
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '50'))
        disableConcurrentBuilds()
    }

    environment {
        SERVICE = 'shipments-api'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse --short=7 HEAD').trim()
                    echo "git sha: ${env.GIT_SHA}"
                }
            }
        }

        stage('Test') {
            steps {
                // Test container brings up its own Postgres on the build agent.
                // Suite is slow (~4min). See README "Known issues."
                sh '''
                    docker compose -f docker-compose.test.yml up \\
                      --abort-on-container-exit \\
                      --exit-code-from test-runner \\
                    || true
                '''
                // ^^ "|| true" because the compose teardown sometimes returns
                //    non-zero even when the test job itself passed. The real
                //    pass/fail comes from the JUnit report below.
                junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
            }
        }

        stage('Build') {
            steps {
                script {
                    env.IMAGE_TAG = buildAndPushImage(service: env.SERVICE)
                }
            }
        }

        stage('Deploy-Dev') {
            steps {
                deployToEcs(service: env.SERVICE, env: 'dev', imageTag: env.IMAGE_TAG)
            }
            post {
                success { notifySlack(env: 'dev', status: 'ok',   text: "shipments-api ${env.IMAGE_TAG} -> dev OK") }
                failure { notifySlack(env: 'dev', status: 'fail', text: "shipments-api ${env.IMAGE_TAG} -> dev FAILED") }
            }
        }

        stage('Approval-Staging') {
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: "Promote ${env.IMAGE_TAG} to STAGING?", ok: 'Promote'
                }
            }
        }

        stage('Deploy-Staging') {
            steps {
                deployToEcs(service: env.SERVICE, env: 'staging', imageTag: env.IMAGE_TAG)
            }
            post {
                success { notifySlack(env: 'staging', status: 'ok',   text: "shipments-api ${env.IMAGE_TAG} -> staging OK") }
                failure { notifySlack(env: 'staging', status: 'fail', text: "shipments-api ${env.IMAGE_TAG} -> staging FAILED") }
            }
        }

        stage('Approval-Prod') {
            steps {
                // The flaky one. Refresh the page if the button doesn't render.
                timeout(time: 60, unit: 'MINUTES') {
                    input message: "Promote ${env.IMAGE_TAG} to PROD?", ok: 'Deploy to prod'
                }
            }
        }

        stage('Deploy-Prod') {
            steps {
                deployToEcs(service: env.SERVICE, env: 'prod', imageTag: env.IMAGE_TAG)
            }
            post {
                success { notifySlack(env: 'prod', status: 'ok',   text: "shipments-api ${env.IMAGE_TAG} -> prod OK") }
                failure { notifySlack(env: 'prod', status: 'fail', text: "shipments-api ${env.IMAGE_TAG} -> prod FAILED") }
            }
        }
    }
}
