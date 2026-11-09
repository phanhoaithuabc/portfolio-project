FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS node
FROM docker:28-cli@sha256:625d9431a9f54c5a2bc90f24f0e1c3d55b1349fd857dd85035f98c2c9acbdd4d AS docker
FROM aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb AS trivy
FROM ghcr.io/sigstore/cosign/cosign:v2.4.1@sha256:b03690aa52bfe94054187142fba24dc54137650682810633901767d8a3e15b31 AS cosign
FROM jenkins/inbound-agent:jdk21@sha256:5069347cd3e72e5924e54c04fceb67209b41c8d0a3ab1c2b3f740e5fb2fab92a
USER root
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git jq skopeo unzip \
  && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/ /usr/local/
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
COPY --from=trivy /usr/local/bin/trivy /usr/local/bin/trivy
COPY --from=cosign /ko-app/cosign /usr/local/bin/cosign
ARG HELM_VERSION=3.17.3
ARG HELM_SHA256=ee88b3c851ae6466a3de507f7be73fe94d54cbf2987cbaa3d1a3832ea331f2cd
ARG TERRAFORM_VERSION=1.11.4
ARG TERRAFORM_SHA256=1ce994251c00281d6845f0f268637ba50c0005657eb3cf096b92f753b42ef4dc
RUN curl -fsSL "https://get.helm.sh/helm-v${HELM_VERSION}-linux-amd64.tar.gz" -o /tmp/helm.tar.gz \
  && echo "${HELM_SHA256}  /tmp/helm.tar.gz" | sha256sum --check --strict \
  && tar -xzf /tmp/helm.tar.gz -C /tmp \
  && install /tmp/linux-amd64/helm /usr/local/bin/helm \
  && curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" -o /tmp/terraform.zip \
  && echo "${TERRAFORM_SHA256}  /tmp/terraform.zip" | sha256sum --check --strict \
  && unzip /tmp/terraform.zip -d /tmp/tf \
  && install /tmp/tf/terraform /usr/local/bin/terraform \
  && rm -rf /tmp/helm.tar.gz /tmp/linux-amd64 /tmp/tf /tmp/terraform.zip
USER jenkins
