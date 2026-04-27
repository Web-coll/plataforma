const state = {
  userType: 'asalariado',
  income: 3200,
  fixedCosts: 1450,
  minDebtPayment: 280,
  totalDebt: 12400,
  hasDebt: true,
  emergencyMonths: 0.7,
  consistency: 62,
  streak: 0,
};

const allocationModels = {
  deuda_critica: { debt: 70, emergency: 25, investment: 5, label: 'Etapa: Deuda crítica' },
  estabilizacion: { debt: 40, emergency: 35, investment: 25, label: 'Etapa: Estabilización' },
  crecimiento: { debt: 10, emergency: 20, investment: 70, label: 'Etapa: Crecimiento' },
  sin_deuda: { debt: 0, emergency: 35, investment: 65, label: 'Etapa: Sin deudas' },
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
  if (!model.hasDebt || model.totalDebt === 0) return allocationModels.sin_deuda;
  if (model.totalDebt > model.income * 3 || model.emergencyMonths < 1) return allocationModels.deuda_critica;
  if (model.emergencyMonths >= 3 && model.totalDebt < model.income * 0.7) return allocationModels.crecimiento;
  return allocationModels.estabilizacion;
}

function calculateBudget(model, stage) {
  const income = Math.max(model.income, 1);
  const fixedCosts = clamp(model.fixedCosts, 0, income);
  const minDebt = model.hasDebt ? clamp(model.minDebtPayment, 0, income - fixedCosts) : 0;
  const disposable = Math.max(income - fixedCosts - minDebt, 0);

  const debtExtra = Math.round(disposable * (stage.debt / 100));
  const emergencyExtra = Math.round(disposable * (stage.emergency / 100));
  const investmentExtra = Math.round(disposable * (stage.investment / 100));
  const assigned = fixedCosts + minDebt + debtExtra + emergencyExtra + investmentExtra;
  const remaining = Math.max(income - assigned, 0);

  return {
    disposable,
    fixedCosts,
    minDebt,
    debtExtra,
    emergencyExtra,
    investmentExtra,
    remaining,
  };
}

function generateRules(model, method, stage, budget) {
  const fixedRatio = model.fixedCosts / Math.max(model.income, 1);
  return [
    fixedRatio > 0.5
      ? 'Si gastos fijos > 50%, activar Modo Ajuste: no subir inversión hasta recuperar margen.'
      : 'Si gastos fijos ≤ 50%, mantener flujo automático y acelerar metas.',
    model.emergencyMonths < 1
      ? 'Si fondo de emergencia < 1 mes, priorizar aportes semanales al colchón.'
      : 'Si fondo de emergencia ≥ 1 mes, usar distribución balanceada.',
    model.hasDebt
      ? `Si consistencia ${model.consistency}% y múltiples deudas, aplicar método ${method}.`
      : 'Si no hay deuda, redirigir excedente a emergencia + inversión en EE.UU.',
    `Ingreso ${money(model.income)} - Gastos fijos ${money(model.fixedCosts)} - Mínimo deuda ${money(budget.minDebt)} = Excedente ${money(budget.disposable)}.`,
  ];
}

function buildDonut(model, budget) {
  const income = Math.max(model.income, 1);
  const blocks = [
    { name: 'Gastos fijos', value: budget.fixedCosts, color: '#8ea5ff' },
    { name: 'Pago mínimo deuda', value: budget.minDebt, color: '#4f6cd9' },
    { name: 'Deuda extra', value: budget.debtExtra, color: '#ff6c81' },
    { name: 'Fondo emergencia', value: budget.emergencyExtra, color: '#ffc56b' },
    { name: 'Inversión US', value: budget.investmentExtra, color: '#5aa6ff' },
    { name: 'Libre / buffer', value: budget.remaining, color: '#41e6b0' },
  ].filter((b) => b.value > 0);

  let cursor = 0;
  const stops = blocks.map((b) => {
    const start = cursor;
    const pct = (b.value / income) * 100;
    cursor += pct;
    return `${b.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });

  $('donutChart').style.background = `conic-gradient(${stops.join(', ')})`;
  $('allocationLegend').innerHTML = blocks
    .map((b) => {
      const pct = ((b.value / income) * 100).toFixed(1);
      return `<li><span class="dot" style="background:${b.color}"></span>${b.name}: ${money(b.value)} (${pct}%)</li>`;
    })
    .join('');
}

function projectMonths(model, budget) {
  const debtPay = budget.debtExtra + budget.minDebt;

  return [3, 6, 12].map((m) => {
    const remainingDebt = model.hasDebt ? clamp(model.totalDebt - debtPay * m, 0, model.totalDebt) : 0;
    const emergencyFund = budget.emergencyExtra * m;
    const investGrowth = budget.investmentExtra * m * 1.03;
    const debtFreeInMonths = debtPay > 0 ? Math.ceil(model.totalDebt / debtPay) : 0;

    return { months: m, remainingDebt, emergencyFund, portfolio: investGrowth, debtFreeInMonths };
  });
}

function renderProjection(model, projections) {
  const wrap = $('projectionCards');
  const template = $('projectionTemplate');
  wrap.innerHTML = '';

  projections.forEach((p) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const paid = model.hasDebt ? model.totalDebt - p.remainingDebt : 0;
    node.querySelector('h4').textContent = `${p.months} meses`;
    node.querySelector('.number').textContent = model.hasDebt ? `${money(paid)} pagados` : `${money(p.portfolio)} invertidos`;
    node.querySelector('small').textContent = model.hasDebt
      ? `Deuda restante ${money(p.remainingDebt)} · Cartera ${money(p.portfolio)}`
      : `Fondo ${money(p.emergencyFund)} · Cartera ${money(p.portfolio)}`;
    wrap.appendChild(node);
  });

  const debtFreedom = projections[2].debtFreeInMonths;
  $('daysGained').textContent = model.hasDebt ? `${Math.max(7, Math.round((365 - debtFreedom * 30) / 2))} días` : '90 días';
}

function missionList(model, method, budget) {
  if (!model.hasDebt) {
    return [
      `Transfiere ${money(budget.emergencyExtra)} al fondo de emergencia hoy.`,
      `Invierte ${money(budget.investmentExtra)} en cartera US este jueves.`,
      'Automatiza una transferencia semanal para mantener consistencia.',
      'Revisa tus gastos variables y libera al menos $20 para acelerar ahorro.',
    ];
  }

  return [
    `Paga ${money(budget.debtExtra)} extra a deuda prioritaria (${method}) antes del viernes.`,
    `Transfiere ${money(budget.emergencyExtra)} al fondo de emergencia hoy.`,
    `Invierte ${money(budget.investmentExtra)} en cartera US de forma automática.`,
    'Revisa un gasto variable y recorta al menos $20 para reforzar el plan.',
  ];
}

function triggerReveals() {
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.animationDelay = `${i * 80}ms`;
    el.classList.add('is-visible');
  });
}

function render() {
  const bias = userMultipliers[state.userType];
  const adjustedEmergencyMonths = +(state.emergencyMonths / bias.emergencyBoost).toFixed(2);
  const consistency = Math.round(state.consistency * bias.consistencyBias);

  const model = {
    userType: state.userType,
    income: state.income,
    fixedCosts: state.fixedCosts,
    minDebtPayment: state.minDebtPayment,
    totalDebt: state.totalDebt,
    hasDebt: state.hasDebt,
    emergencyMonths: adjustedEmergencyMonths,
    consistency,
  };

  const method = chooseDebtMethod(consistency);
  const stage = chooseStage(model);
  const budget = calculateBudget(model, stage);
  const rules = generateRules(model, method, stage, budget);
  const projections = projectMonths(model, budget);

  $('kpiDebt').textContent = money(model.totalDebt);
  $('kpiDebtStatus').textContent = model.hasDebt ? `Pago mínimo mensual ${money(model.minDebtPayment)}` : 'Sin deuda activa';
  $('kpiEmergency').textContent = `${adjustedEmergencyMonths} meses`;
  $('kpiNetWorth').textContent = money(Math.max(0, projections[2].portfolio + projections[2].emergencyFund - projections[2].remainingDebt));
  $('stagePill').textContent = stage.label;
  $('nextActionAmount').textContent = money(model.hasDebt ? budget.debtExtra : budget.investmentExtra);
  $('nextActionDebt').textContent = model.hasDebt ? (method === 'Avalancha' ? 'tarjeta de mayor interés' : 'deuda más pequeña') : 'inversión automática';

  buildDonut(model, budget);
  renderProjection(model, projections);

  $('rulesList').innerHTML = rules.map((r) => `<li>${r}</li>`).join('');
  $('missionsList').innerHTML = missionList(model, method, budget)
    .map((m, i) => `<li class="${i < state.streak ? 'done' : ''}"><input type="checkbox" ${i < state.streak ? 'checked' : ''}/> ${m}</li>`)
    .join('');

  $('streakPill').textContent = `Racha: ${state.streak} semana${state.streak === 1 ? '' : 's'}`;

  document.querySelectorAll('.kpi, .number').forEach((el) => {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  });
}

function syncForm() {
  $('income').value = state.income;
  $('fixedCosts').value = state.fixedCosts;
  $('minDebtPayment').value = state.minDebtPayment;
  $('totalDebt').value = state.totalDebt;
}

$('onboardHasDebt').addEventListener('change', (e) => {
  const hasDebt = e.target.value === 'si';
  $('onboardDebtTotalWrap').classList.toggle('hidden', !hasDebt);
  $('onboardDebtMinWrap').classList.toggle('hidden', !hasDebt);
});

$('onboardingForm').addEventListener('submit', (e) => {
  e.preventDefault();
  state.userType = $('onboardUserType').value;
  state.income = +$('onboardIncome').value || 0;
  state.fixedCosts = +$('onboardFixedCosts').value || 0;
  state.hasDebt = $('onboardHasDebt').value === 'si';
  state.totalDebt = state.hasDebt ? +$('onboardTotalDebt').value || 0 : 0;
  state.minDebtPayment = state.hasDebt ? +$('onboardMinDebtPayment').value || 0 : 0;
  state.consistency = clamp(Math.round(100 - ((state.fixedCosts / Math.max(state.income, 1)) * 40)), 40, 95);

  $('onboardingWrap').classList.add('fade-out');
  setTimeout(() => {
    $('onboardingWrap').classList.add('hidden');
    $('appHeader').classList.remove('hidden');
    $('appMain').classList.remove('hidden');
    triggerReveals();
    syncForm();
    render();
  }, 260);
});

$('runSimulation').addEventListener('click', () => {
  state.income = +$('income').value || 0;
  state.fixedCosts = +$('fixedCosts').value || 0;
  state.minDebtPayment = +$('minDebtPayment').value || 0;
  state.totalDebt = +$('totalDebt').value || 0;
  state.hasDebt = state.totalDebt > 0;
  state.consistency = clamp(Math.round(100 - ((state.fixedCosts / Math.max(state.income, 1)) * 40)), 40, 95);
  render();
});

$('executeAction').addEventListener('click', () => {
  state.streak = clamp(state.streak + 1, 0, 4);
  if (state.hasDebt) {
    state.totalDebt = clamp(state.totalDebt - 150, 0, Number.MAX_SAFE_INTEGER);
    state.hasDebt = state.totalDebt > 0;
  }
  render();
});
