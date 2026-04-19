#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT_DIR}/.local-ssl"
KEY_FILE="${CERT_DIR}/dev-key.pem"
CERT_FILE="${CERT_DIR}/dev-cert.pem"
OPENSSL_CONFIG="${CERT_DIR}/openssl.cnf"

mkdir -p "${CERT_DIR}"

discover_ips() {
  local ips=()

  if command -v ipconfig >/dev/null 2>&1; then
    while IFS= read -r ip; do
      [[ -n "${ip}" ]] && ips+=("${ip}")
    done < <(
      {
        ipconfig getifaddr en0 2>/dev/null || true
        ipconfig getifaddr en1 2>/dev/null || true
        ipconfig getifaddr en2 2>/dev/null || true
      } | awk 'NF'
    )
  fi

  if command -v hostname >/dev/null 2>&1; then
    while IFS=' ' read -r -a found; do
      for ip in "${found[@]}"; do
        [[ -n "${ip}" ]] && ips+=("${ip}")
      done
    done < <(hostname -I 2>/dev/null || true)
  fi

  printf '%s\n' "${ips[@]}" | awk 'NF && !seen[$0]++'
}

discover_names() {
  local names=("localhost" "127.0.0.1" "::1")
  local host_name=""
  local local_host_name=""

  host_name="$(hostname 2>/dev/null || true)"
  local_host_name="$(scutil --get LocalHostName 2>/dev/null || true)"

  [[ -n "${host_name}" ]] && names+=("${host_name}")
  [[ -n "${host_name}" ]] && names+=("${host_name}.local")
  [[ -n "${local_host_name}" ]] && names+=("${local_host_name}")
  [[ -n "${local_host_name}" ]] && names+=("${local_host_name}.local")

  printf '%s\n' "${names[@]}" | awk 'NF && !seen[$0]++'
}

IP_LIST=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && IP_LIST+=("${line}")
done < <(discover_ips)

NAME_LIST=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && NAME_LIST+=("${line}")
done < <(discover_names)

if command -v mkcert >/dev/null 2>&1; then
  mkcert -cert-file "${CERT_FILE}" -key-file "${KEY_FILE}" "${NAME_LIST[@]}" "${IP_LIST[@]}"
  echo "Generated trusted dev cert with mkcert:"
  echo "  ${CERT_FILE}"
  echo "  ${KEY_FILE}"
  exit 0
fi

cat > "${OPENSSL_CONFIG}" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names
extendedKeyUsage = serverAuth

[alt_names]
EOF

dns_index=1
ip_index=1

for name in "${NAME_LIST[@]}"; do
  if [[ "${name}" == *:* ]] || [[ "${name}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "IP.${ip_index} = ${name}" >> "${OPENSSL_CONFIG}"
    ip_index=$((ip_index + 1))
  else
    echo "DNS.${dns_index} = ${name}" >> "${OPENSSL_CONFIG}"
    dns_index=$((dns_index + 1))
  fi
done

for ip in "${IP_LIST[@]}"; do
  echo "IP.${ip_index} = ${ip}" >> "${OPENSSL_CONFIG}"
  ip_index=$((ip_index + 1))
done

openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -config "${OPENSSL_CONFIG}"

echo "Generated self-signed dev cert:"
echo "  ${CERT_FILE}"
echo "  ${KEY_FILE}"
echo
echo "This will still show as untrusted on your phone unless that device trusts the issuing CA."
