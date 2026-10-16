#!/bin/sh
# GoClaw fork: container entrypoint — starts Xvfb (virtual display) if
# installed (OPENCLAW_INSTALL_BROWSER=1 image builds), then exec's the
# actual command (gateway, CLI, etc.).

if command -v Xvfb > /dev/null 2>&1 && [ -z "$DISPLAY" ]; then
  Xvfb :1 -screen 0 1280x800x24 -ac -nolisten tcp &
  export DISPLAY=:1
fi

exec "$@"
