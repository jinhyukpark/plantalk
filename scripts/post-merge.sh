#!/bin/bash
set -e

# Install/refresh JS dependencies for the Expo app (fast no-op when unchanged)
npm install --no-audit --no-fund

# Backend (Spring Boot) dependencies are resolved by Maven at workflow start;
# database schema is managed by Hibernate ddl-auto, so no migration step needed.

echo "Post-merge setup complete."
