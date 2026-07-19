FROM node:24-bookworm

ARG ACT_VERSION=0.2.89
ARG ACTIONLINT_VERSION=1.7.12

RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    ripgrep \
    unzip \
    zip; \
  rm -rf /var/lib/apt/lists/*; \
    debian_arch="$(dpkg --print-architecture)"; \
    case "${debian_arch}" in \
      amd64) \
        act_arch="x86_64"; \
        actionlint_arch="amd64"; \
        ;; \
      arm64) \
        act_arch="arm64"; \
        actionlint_arch="arm64"; \
        ;; \
      *) \
        echo "Unsupported architecture: ${debian_arch}" >&2; \
        exit 1; \
        ;; \
    esac; \
    act_asset="act_Linux_${act_arch}.tar.gz"; \
    actionlint_asset="actionlint_${ACTIONLINT_VERSION}_linux_${actionlint_arch}.tar.gz"; \
    curl -fsSL "https://github.com/nektos/act/releases/download/v${ACT_VERSION}/${act_asset}" -o /tmp/act.tar.gz; \
    curl -fsSL "https://github.com/nektos/act/releases/download/v${ACT_VERSION}/checksums.txt" -o /tmp/act-checksums.txt; \
    curl -fsSL "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${actionlint_asset}" -o /tmp/actionlint.tar.gz; \
    curl -fsSL "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_checksums.txt" -o /tmp/actionlint-checksums.txt; \
    act_checksum="$(awk -v asset="${act_asset}" '$2 == asset { print $1; exit }' /tmp/act-checksums.txt)"; \
    actionlint_checksum="$(awk -v asset="${actionlint_asset}" '$2 == asset { print $1; exit }' /tmp/actionlint-checksums.txt)"; \
    test -n "${act_checksum}"; \
    test -n "${actionlint_checksum}"; \
    printf '%s  %s\n' "${act_checksum}" /tmp/act.tar.gz | sha256sum -c -; \
    printf '%s  %s\n' "${actionlint_checksum}" /tmp/actionlint.tar.gz | sha256sum -c -; \
    mkdir -p /tmp/act /tmp/actionlint; \
    tar -xzf /tmp/act.tar.gz -C /tmp/act act; \
    tar -xzf /tmp/actionlint.tar.gz -C /tmp/actionlint actionlint; \
    install -m 0755 /tmp/act/act /usr/local/bin/act; \
    install -m 0755 /tmp/actionlint/actionlint /usr/local/bin/actionlint; \
    act --version; \
    actionlint -version; \
    rm -rf /tmp/act /tmp/actionlint /tmp/act.tar.gz /tmp/act-checksums.txt /tmp/actionlint.tar.gz /tmp/actionlint-checksums.txt; \
    if [ -L /var/run ]; then \
      rm /var/run; \
      mkdir /var/run; \
    fi
