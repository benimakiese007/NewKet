---
title: NewKet AI Vision Service
emoji: 🔍
colorFrom: orange
colorTo: red
sdk: docker
app_port: 8000
pinned: false
short_description: YOLO + CLIP visual search API for NewKet marketplace
---

# NewKet AI Vision Service

API de recherche visuelle pour NewKet.

- **YOLO v8** — Détection d'objets
- **CLIP ViT-B/32** — Génération d'embeddings 512d
- **FastAPI** — API REST

## Endpoint

`POST /analyze` — Envoie une image, reçoit les objets détectés + vecteurs CLIP.
