pipeline {
  agent { label 'portfolio-rootless-builder' }
  options { timestamps(); disableConcurrentBuilds(); timeout(time: 45, unit: 'MINUTES'); buildDiscarder(logRotator(numToKeepStr: '15')) }
  environment {
    REGISTRY = 'ghcr.io'
    IMAGE_PREFIX = 'phanhoaithuabc'
    GITOPS_BRANCH = 'main'
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'bash ci/jenkins/check-rootless-agent.sh'
        script {
          env.BUILD_STARTED_AT = sh(script: 'date -u +%Y-%m-%dT%H:%M:%SZ', returnStdout: true).trim()
          env.IMAGE_TAG = "sha-${env.GIT_COMMIT}"
          env.API_IMAGE = "${env.REGISTRY}/${env.IMAGE_PREFIX}/portfolio-api:${env.IMAGE_TAG}"
          env.WEB_IMAGE = "${env.REGISTRY}/${env.IMAGE_PREFIX}/portfolio-web:${env.IMAGE_TAG}"
          env.API_TEST_IMAGE = "localhost/portfolio-api-test:${env.BUILD_NUMBER}"
          env.CI_NETWORK = "portfolio-ci-${env.BUILD_NUMBER}"
        }
      }
    }
    stage('Validate and publish') {
      when { not { changelog '\\[gitops\\]' } }
      stages {
        stage('Unit, build, lint') {
          steps {
            sh 'npm ci'
            sh 'npm test'
            sh 'npm run build'
            sh 'npm run lint -w @portfolio/web'
            sh 'npm run format:check'
          }
        }
        stage('Deployment validation') {
          steps {
            sh 'node scripts/validate-deployments.mjs'
            sh 'node ci/validate-database-hosts.mjs'
            sh 'node ci/validate-native-databases.mjs'
            sh 'for root in infra/aws infra/aws-media infra/azure infra/gcp infra/modules; do terraform fmt -check -recursive "$root"; done'
            sh 'for root in aws aws-media azure gcp; do terraform -chdir=infra/$root init -backend=false -input=false && terraform -chdir=infra/$root validate; done'
          }
        }
        stage('Build images') {
          steps {
            sh 'docker build --pull --target test -t "$API_TEST_IMAGE" .'
            sh 'docker build --pull --target runtime -t "$API_IMAGE" .'
            sh 'docker build --pull -f apps/portfolio/Dockerfile -t "$WEB_IMAGE" .'
          }
        }
        stage('Database integration') {
          steps {
            sh 'docker network create "$CI_NETWORK"'
            sh 'docker run -d --name "$CI_NETWORK" --network "$CI_NETWORK" --network-alias postgres -e POSTGRES_DB=portfolio -e POSTGRES_USER=portfolio -e POSTGRES_PASSWORD=ci-only-password postgres:17-alpine'
            timeout(time: 2, unit: 'MINUTES') { waitUntil { script { return sh(script: 'docker exec "$CI_NETWORK" pg_isready -U portfolio', returnStatus: true) == 0 } } }
            sh 'docker run --rm --network "$CI_NETWORK" -e TEST_PORTFOLIO_DATABASE_URL=postgresql://portfolio:ci-only-password@postgres:5432/portfolio "$API_TEST_IMAGE"'
          }
        }
        stage('Security gates') {
          steps {
            sh 'npm audit --audit-level=high'
            sh 'mkdir -p reports/security'
            sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL "$API_IMAGE"'
            sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL --format cyclonedx --output reports/security/api.cdx.json "$API_IMAGE"'
            sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL "$WEB_IMAGE"'
            sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL --format cyclonedx --output reports/security/web.cdx.json "$WEB_IMAGE"'
          }
        }
        stage('Publish immutable images') {
          when { branch 'main' }
          steps { script {
            withCredentials([usernamePassword(credentialsId: 'portfolio-registry-push', usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_PASSWORD')]) {
              sh '''set +x
                trap 'docker logout "$REGISTRY" >/dev/null 2>&1 || true' EXIT
                printf '%s' "$REGISTRY_PASSWORD" | docker login "$REGISTRY" -u "$REGISTRY_USER" --password-stdin
                docker push "$API_IMAGE"
                docker push "$WEB_IMAGE"
                node scripts/resolve-image-digest.mjs "$API_IMAGE" > reports/security/api.digest
                node scripts/resolve-image-digest.mjs "$WEB_IMAGE" > reports/security/web.digest
              '''
            }
            env.API_DIGEST = readFile('reports/security/api.digest').trim()
            env.WEB_DIGEST = readFile('reports/security/web.digest').trim()
            env.API_REPOSITORY = "${env.REGISTRY}/${env.IMAGE_PREFIX}/portfolio-api"
            env.WEB_REPOSITORY = "${env.REGISTRY}/${env.IMAGE_PREFIX}/portfolio-web"
          } }
        }
        stage('Sign and attest artifacts') {
          when { branch 'main' }
          steps {
            sh 'node scripts/create-provenance.mjs "$API_IMAGE" "$API_DIGEST" "$GIT_COMMIT" reports/security/api.provenance.json'
            sh 'node scripts/create-provenance.mjs "$WEB_IMAGE" "$WEB_DIGEST" "$GIT_COMMIT" reports/security/web.provenance.json'
            withCredentials([
              file(credentialsId: 'cosign-signing-key', variable: 'COSIGN_KEY'),
              string(credentialsId: 'cosign-key-password', variable: 'COSIGN_PASSWORD'),
              file(credentialsId: 'cosign-public-key', variable: 'COSIGN_PUBLIC_KEY')
            ]) {
              sh '''set +x
                for image in "$API_REPOSITORY@$API_DIGEST" "$WEB_REPOSITORY@$WEB_DIGEST"; do
                  cosign sign --yes --key "$COSIGN_KEY" "$image"
                done
                cosign attest --yes --key "$COSIGN_KEY" --type cyclonedx --predicate reports/security/api.cdx.json "$API_REPOSITORY@$API_DIGEST"
                cosign attest --yes --key "$COSIGN_KEY" --type slsaprovenance --predicate reports/security/api.provenance.json "$API_REPOSITORY@$API_DIGEST"
                cosign attest --yes --key "$COSIGN_KEY" --type cyclonedx --predicate reports/security/web.cdx.json "$WEB_REPOSITORY@$WEB_DIGEST"
                cosign attest --yes --key "$COSIGN_KEY" --type slsaprovenance --predicate reports/security/web.provenance.json "$WEB_REPOSITORY@$WEB_DIGEST"
                for image in "$API_REPOSITORY@$API_DIGEST" "$WEB_REPOSITORY@$WEB_DIGEST"; do
                  cosign verify --key "$COSIGN_PUBLIC_KEY" "$image"
                  cosign verify-attestation --key "$COSIGN_PUBLIC_KEY" --type cyclonedx "$image"
                  cosign verify-attestation --key "$COSIGN_PUBLIC_KEY" --type slsaprovenance "$image"
                done
              '''
            }
            archiveArtifacts artifacts: 'reports/security/*', fingerprint: true
          }
        }
        stage('Open reviewed promotion PR') {
          when { branch 'main' }
          steps {
            withCredentials([usernamePassword(credentialsId: 'gitops-push', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
              sh '''set +x
                commit_short=$(printf '%s' "$GIT_COMMIT" | cut -c1-12)
                api_short=$(printf '%s' "$API_DIGEST" | cut -c8-17)
                web_short=$(printf '%s' "$WEB_DIGEST" | cut -c8-17)
                promotion_branch="automation/portfolio-$commit_short-$api_short-$web_short"
                credential_helper='!f() { printf "username=%s\\npassword=%s\\n" "$GIT_USERNAME" "$GIT_PASSWORD"; }; f'
                git -c "credential.helper=$credential_helper" fetch origin "$GITOPS_BRANCH"
                if git -c "credential.helper=$credential_helper" ls-remote --exit-code --heads origin "$promotion_branch" >/dev/null 2>&1; then
                  git -c "credential.helper=$credential_helper" fetch origin "$promotion_branch"
                  git checkout -B "$promotion_branch" "origin/$promotion_branch"
                else
                  git checkout -B "$promotion_branch" "origin/$GITOPS_BRANCH"
                fi
                node ci/update-portfolio-images.mjs "$REGISTRY/$IMAGE_PREFIX" "$IMAGE_TAG" "$API_DIGEST" "$WEB_DIGEST"
                git config user.name 'Portfolio CI'
                git config user.email 'ci@portfolio.invalid'
                git add deploy/gitops/portfolio/images.yaml
                if git diff --cached --quiet && git diff --quiet "origin/$GITOPS_BRANCH" -- deploy/gitops/portfolio/images.yaml; then
                  echo "The requested digests are already in the GitOps base branch."
                  exit 0
                fi
                if ! git diff --cached --quiet; then
                  git commit -m "[gitops] deploy portfolio $IMAGE_TAG by digest"
                  git -c "credential.helper=$credential_helper" push origin HEAD:"$promotion_branch"
                fi
                GITOPS_TOKEN="$GIT_PASSWORD" GITOPS_BRANCH="$GITOPS_BRANCH" node scripts/open-gitops-pr.mjs "$promotion_branch" "$IMAGE_TAG" "$API_DIGEST" "$WEB_DIGEST"
              '''
            }
          }
        }
      }
    }
  }
  post {
    always {
      sh 'docker rm -f "$CI_NETWORK" >/dev/null 2>&1 || true'
      sh 'docker network rm "$CI_NETWORK" >/dev/null 2>&1 || true'
      sh 'docker image rm "$API_TEST_IMAGE" >/dev/null 2>&1 || true'
    }
  }
}