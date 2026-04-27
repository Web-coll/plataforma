const state = {
  userType: 'asalariado',
  income: 3200,
  fixedCosts: 1450,
  minDebtPayment: 280,
  totalDebt: 12400,
  emergencyMonths: 1.8,
  consistency: 62,
  streak: 0,
};

const allocationModels = {
  deuda_critica: { debt: 70, emergency: 25, investment: 5, label: 'Etapa: Deuda crítica' },
  estabilizacion: { debt: 40, emergency: 30, investment: 30, label: 'Etapa: Estabilización' },
  crecimiento: { debt: 15, emergency: 20, investment: 65, label: 'Etapa: Crecimiento' },
};

const userMultipliers = {
  asalariado: { emergencyBoost: 1, consistencyBias: 1.1 },
  estudiante: { emergencyBoost: 1.2, consistencyBias: 0.9 },
  autonomo: { emergencyBoost: 1.35, consistencyBias: 0.95 },
};

const $ = (id) => document.getElementById(id);

function money(n) {
  return `$${Math.max(0, n).toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function chooseDebtMethod(consistency, debtCount = 4) {
  if (consistency >= 80) return 'Avalancha';
  if (debtCount >= 3 || consistency < 65) return 'Bola de nieve';
  return 'Avalancha';
}

function chooseStage(model) {
  if (model.totalDebt > model.income * 3 || model.emergencyMonths < 1) return allocationModels.deuda_critica;
  if (model.emergencyMonths >= 3 && model.totalDebt < model.income * 0.7) return allocationModels.crecimiento;
  return allocationModels.estabilizacion;
}

function generateRules(model, method, stage) {
  const fixedRatio = model.fixedCosts / model.income;
  return [
    fixedRatio > 0.5
      ? 'Si gastos fijos > 50%, activar Modo Ajuste: congelar aumento de inversión y optimizar costos variables.'
      : 'Si gastos fijos ≤ 50%, mantener flujo automático y acelerar metas de crecimiento.',
    model.emergencyMonths < 1
      ? 'Si fondo de emergencia < 1 mes, priorizar aportes mínimos semanales hasta alcanzar colchón básico.'
      : 'Si fondo de emergencia ≥ 1 mes, usar distribución balanceada entre deuda, ahorro e inversión.',
    `Si consistencia ${model.consistency}% y múltiples deudas, usar método ${method} para priorizar pagos.`,
    `Excedente mensual: ${money(model.surplus)} → Deuda ${stage.debt}% / Emergencia ${stage.emergency}% / Inversión ${stage.investment}%.`,
  ];
}

function buildDonut(stage) {
  const donut = $('donutChart');
  donut.style.background = `conic-gradient(
    var(--danger) 0 ${stage.debt}%,
    var(--warning) ${stage.debt}% ${stage.debt + stage.emergency}%,
    var(--accent-2) ${stage.debt + stage.emergency}% 100%
  )`;

  $('allocationLegend').innerHTML = [
    ['Deuda', stage.debt, 'var(--danger)'],
    ['Emergencia', stage.emergency, 'var(--warning)'],
    ['Inversión US', stage.investment, 'var(--accent-2)'],
  ]
    .map(([name, pct, color]) => `<li><span class="dot" style="background:${color}"></span>${name}: ${pct}%</li>`)
    .join('');
}

function projectMonths(model, stage) {
  const debtPay = model.surplus * (stage.debt / 100) + model.minDebtPayment;
  const emergencyAdd = model.surplus * (stage.emergency / 100);
  const investAdd = model.surplus * (stage.investment / 100);

  return [3, 6, 12].map((m) => {
    const remainingDebt = clamp(model.totalDebt - debtPay * m, 0, model.totalDebt);
    const emergencyFund = emergencyAdd * m;
    const investGrowth = investAdd * m * 1.03;
    return {
      months: m,
      remainingDebt,
      emergencyFund,
      portfolio: investGrowth,
      debtFreeInMonths: Math.ceil(model.totalDebt / debtPay),
    };
  });
}

function renderProjection(model, projections) {
  const wrap = $('projectionCards');
  const template = $('projectionTemplate');
  wrap.innerHTML = '';

  projections.forEach((p) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('h4').textContent = `${p.months} meses`;
    node.querySelector('.number').textContent = `${money(model.totalDebt - p.remainingDebt)} pagados`;
    node.querySelector('small').textContent = `Deuda restante ${money(p.remainingDebt)} · Cartera ${money(p.portfolio)}`;
    wrap.appendChild(node);
  });

  const debtFreedom = projections[2].debtFreeInMonths;
  $('daysGained').textContent = `${Math.max(7, Math.round((365 - debtFreedom * 30) / 2))} días`;
}

function missionList(model, stage, method) {
  const debtExtra = Math.round(model.surplus * (stage.debt / 100));
  const emergencyExtra = Math.round(model.surplus * (stage.emergency / 100));
  const investmentExtra = Math.round(model.surplus * (stage.investment / 100));

  return [
    `Transfiere ${money(emergencyExtra)} al fondo de emergencia hoy.`,
    `Paga ${money(debtExtra)} extra a la deuda prioritaria (${method}) antes del viernes.`,
    `Invierte ${money(investmentExtra)} en cartera US de forma automática este jueves.`,
    'Revisa un gasto variable y recorta al menos $20 para reforzar el plan.',
  ];
}

function render() {
  const bias = userMultipliers[state.userType];
  const income = state.income;
  const fixedCosts = state.fixedCosts;
  const minDebtPayment = state.minDebtPayment;
  const totalDebt = state.totalDebt;

  const adjustedEmergencyMonths = +(state.emergencyMonths / bias.emergencyBoost).toFixed(2);
  const consistency = Math.round(state.consistency * bias.consistencyBias);
  const surplus = Math.max(income - fixedCosts - minDebtPayment, 0);

  const model = { income, fixedCosts, minDebtPayment, totalDebt, emergencyMonths: adjustedEmergencyMonths, consistency, surplus };
  const method = chooseDebtMethod(consistency);
  const stage = chooseStage(model);
  const rules = generateRules(model, method, stage);
  const projections = projectMonths(model, stage);

  $('kpiDebt').textContent = money(totalDebt);
  $('kpiEmergency').textContent = `${adjustedEmergencyMonths} meses`;
  $('kpiNetWorth').textContent = money(Math.max(0, projections[2].portfolio + adjustedEmergencyMonths * fixedCosts - projections[2].remainingDebt));
  $('stagePill').textContent = stage.label;
  $('nextActionAmount').textContent = money(Math.round(surplus * (stage.debt / 100)));
  $('nextActionDebt').textContent = method === 'Avalancha' ? 'Tarjeta mayor interés' : 'Deuda más pequeña';

  buildDonut(stage);
  renderProjection(model, projections);

  $('rulesList').innerHTML = rules.map((r) => `<li>${r}</li>`).join('');
  $('missionsList').innerHTML = missionList(model, stage, method)
    .map((m, i) => `<li class="${i < state.streak ? 'done' : ''}"><input type="checkbox" ${i < state.streak ? 'checked' : ''}/> ${m}</li>`)
    .join('');

  $('streakPill').textContent = `Racha: ${state.streak} semana${state.streak === 1 ? '' : 's'}`;
}

$('runSimulation').addEventListener('click', () => {
  state.userType = $('userType').value;
  state.income = +$('income').value || 0;
  state.fixedCosts = +$('fixedCosts').value || 0;
  state.minDebtPayment = +$('minDebtPayment').value || 0;
  state.totalDebt = +$('totalDebt').value || 0;
  state.consistency = clamp(Math.round(100 - ((state.fixedCosts / Math.max(state.income, 1)) * 40)), 40, 95);
  render();
});

$('executeAction').addEventListener('click', () => {
  state.streak = clamp(state.streak + 1, 0, 4);
  state.totalDebt = clamp(state.totalDebt - 120, 0, Number.MAX_SAFE_INTEGER);
  render();
});

render();
