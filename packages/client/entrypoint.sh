#!/bin/sh
set -e

# 1. Generate runtime JS config — makes SERVER_URL available to the app at runtime
cat > /usr/share/nginx/html/config.js <<EOF
window.__CONFIG__ = {
  SERVER_URL: "${VITE_SERVER_URL:-}"
};
EOF

# 2. Patch PUBLIC_URL into OG/Twitter meta tags in index.html
#    Vite leaves %VITE_PUBLIC_URL% as a literal string in the built HTML when the
#    variable is not defined at build time — sed replaces it here at container start.
sed -i "s|%VITE_PUBLIC_URL%|${VITE_PUBLIC_URL:-}|g" /usr/share/nginx/html/index.html

exec "$@"
