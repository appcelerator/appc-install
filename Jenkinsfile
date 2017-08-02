library 'pipeline-library'

timestamps {
  node('(osx || linux) && git && npm-publish') {
    stage ('Checkout') {
      checkout scm
    } // stage

    def packageVersion = jsonParse(readFile('package.json'))['version']
    currentBuild.displayName = "#${packageVersion}-${currentBuild.number}"

    def isMaster = env.BRANCH_NAME.equals('master')
    def publish = isMaster // publish if we're on master branch
    def tagGit = publish // tag git if we're going to publish
    def updateJIRATickets = publish // update JIRA tickets if we're publishing

    nodejs(nodeJSInstallationName: 'node 6.9.5') {
      ansiColor('xterm') {
        stage('Security') {
          sh 'npm install --production'
          // Scan for NSP and RetireJS warnings
          sh 'npm install nsp'
          sh 'node_modules/nsp/bin/nsp check --output summary --warn-only'
          sh 'npm uninstall nsp'
          sh 'npm prune'

          // FIXME We already run 'retire' as part of appc-js grunt task in npm test. Can we just use that output?
          sh 'npm install retire'
          sh 'node_modules/retire/bin/retire --exitwith 0'
          sh 'npm uninstall retire'
          sh 'npm prune'

          step([$class: 'WarningsPublisher', canComputeNew: false, canResolveRelativePaths: false, consoleParsers: [[parserName: 'Node Security Project Vulnerabilities'], [parserName: 'RetireJS']], defaultEncoding: '', excludePattern: '', healthy: '', includePattern: '', messagesPattern: '', unHealthy: ''])
        }

        // TODO Run npm-check-updates?
        // npm install npm-check-updates
        // ./node_modules/npm-check-updates/bin/ncu --packageFile ./package.json

        stage('Build') {
          sh 'npm install'
          fingerprint 'package.json'
          try {
            // set special env var so we don't try test requiring sudo prompt
            withEnv(['JENKINS=true']) {
              sh 'npm test'
            }
          } finally {
            // record results even if tests/coverage 'fails'
            junit 'junit_report.xml'
            step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: 'coverage/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
          }
        }

        stage('Publish') {
          if (tagGit) {
            pushGitTag(name: packageVersion, force: true, message: "See ${env.BUILD_URL} for more information.")
          }

          if (publish) {
            sh 'npm publish'
          }

          if (updateJIRATickets) {
            updateJIRA('CLI', packageVersion, scm)
          }
        }
      } // ansiColor
    } // nodejs
  } // node
} // timestamps
