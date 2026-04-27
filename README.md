# FinPilot Web Prototype

Prototipo front-end de una plataforma fintech orientada a **decisiones automatizadas**:

- Prioriza pago de deuda (bola de nieve vs avalancha).
- Distribuye excedente entre deuda, emergencia e inversión.
- Simula resultados a 3, 6 y 12 meses.
- Genera misiones semanales accionables.
- Ajusta la lógica por tipo de usuario: asalariado, estudiante y autónomo.

## Ejecutar localmente

```bash
python3 -m http.server 8000
```

Luego abre: `http://localhost:8000`

## Archivos

- `index.html`: estructura principal del dashboard.
- `styles.css`: estilos visuales premium + animaciones.
- `app.js`: motor de reglas y simulación en cliente.
