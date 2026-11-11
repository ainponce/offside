#!/usr/bin/env bash
# Clona (o actualiza) el material oficial del Desafío Fútbol en .simulador/.
# Ese código es de la organización: no se copia al repositorio, por eso
# .simulador/ está en .gitignore.
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
destino="$raiz/.simulador/desafio-futbol"

if [ -d "$destino/.git" ]; then
  git -C "$destino" pull --ff-only --quiet
  echo "Material oficial actualizado en $destino"
else
  mkdir -p "$raiz/.simulador"
  git clone --depth 1 --quiet https://github.com/qualydata-org/desafio-futbol "$destino"
  echo "Material oficial clonado en $destino"
fi
