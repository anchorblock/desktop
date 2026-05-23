#!/bin/sh
# Postinst run by dpkg after the Omnizen Desktop .deb unpacks.
#
# Ubuntu 24.04 sets `kernel.apparmor_restrict_unprivileged_userns=1`,
# which blocks Electron's renderer from creating the unprivileged user
# namespace it needs for the sandbox. The result is a blank white window
# on first launch: the renderer process crashes silently inside the
# kernel before any of our code runs.
#
# Electron ships a setuid helper (`chrome-sandbox`) that uses the proper
# SUID-root namespace path instead - immune to the AppArmor restriction.
# electron-builder bundles it but doesn't set the setuid bit by default.
# This postinst does so.

set -e

CHROME_SANDBOX_DST=/opt/Omnizen/chrome-sandbox

if [ -e "$CHROME_SANDBOX_DST" ]; then
    chown root:root "$CHROME_SANDBOX_DST"
    # 4755 = setuid + rwxr-xr-x. Required for Electron's SUID sandbox
    # to work on systems with unprivileged-userns restrictions (Ubuntu
    # 24.04+, hardened distros).
    chmod 4755 "$CHROME_SANDBOX_DST"
fi
