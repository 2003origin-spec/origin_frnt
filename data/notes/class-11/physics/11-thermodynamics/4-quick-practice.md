---
title: "Thermodynamics: Quick Practice"
type: practice
chapter: c11.physics.thermodynamics
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. Take $R = 8.31$ J mol⁻¹ K⁻¹ and $\ln 2 = 0.693$. Signs follow NCERT Physics: $\Delta Q = \Delta U + \Delta W$, with $\Delta W$ = work done **by** the gas.

## First law

:::question{title="1. Heat in, work out" exam="NEET level"}
A gas absorbs 500 J of heat and does 200 J of work on its surroundings. Find the change in its internal energy.

---

$\Delta U = \Delta Q - \Delta W = 500 - 200 =$ **+300 J** (internal energy increases).
:::

:::question{title="2. Work done on the gas" exam="NEET level"}
300 J of work is done **on** a gas, and the gas gives out 100 J of heat. Find the change in its internal energy.

---

In the Physics convention, $\Delta Q = -100$ J (heat given out) and $\Delta W = -300$ J (work done on the gas, not by it).

$\Delta U = \Delta Q - \Delta W = -100 - (-300) =$ **+200 J**.

(Chemistry convention gives the same: $q = -100$, $w = +300$, $\Delta U = q + w = +200$ J.)
:::

## Specific heats

:::question{title="3. Heating at constant pressure" exam="NEET level"}
2 mol of an ideal monatomic gas is heated at constant pressure from 300 K to 400 K. Find the heat supplied, the work done by the gas and the change in internal energy.

---

For a monatomic gas $C_v = \tfrac32 R$ and $C_p = \tfrac52 R$. $\Delta T = 100$ K.

$\Delta U = \mu C_v \Delta T = 2 \times 1.5 \times 8.31 \times 100 =$ **2493 J**.

$W = \mu R \Delta T = 2 \times 8.31 \times 100 =$ **1662 J**.

$\Delta Q = \mu C_p \Delta T = 2 \times 2.5 \times 8.31 \times 100 =$ **4155 J** (check: $2493 + 1662 = 4155$).
:::

:::question{title="4. Where the heat goes" exam="NEET level"}
70 J of heat is given to an ideal diatomic gas at constant pressure. How much of it raises the internal energy, and how much is used as work?

---

The fraction going into internal energy is $\dfrac{C_v}{C_p} = \dfrac{5/2}{7/2} = \dfrac57$.

$\Delta U = \tfrac57 \times 70 =$ **50 J**, and work $= 70 - 50 =$ **20 J**.
:::

## Thermodynamic processes

:::question{title="5. Isothermal expansion" exam="NEET level"}
1 mol of an ideal gas expands isothermally and quasi-statically at 300 K from 10 L to 20 L. Find the work done by the gas and the heat it absorbs.

---

$W = \mu RT\ln\dfrac{V_2}{V_1} = 1 \times 8.31 \times 300 \times \ln 2$

$= 2493 \times 0.693 \approx$ **1728 J** (about 1.73 kJ).

$\Delta U = 0$ (isothermal, ideal gas), so heat absorbed $= W \approx$ **1728 J**.
:::

:::question{title="6. Adiabatic compression" exam="JEE Main level"}
An ideal monatomic gas at 300 K is compressed adiabatically and quasi-statically to $\tfrac18$ of its volume. Find its final temperature, and by what factor its pressure rises.

---

$\gamma = \tfrac53$, so $\gamma - 1 = \tfrac23$. From $TV^{\gamma-1}$ = constant:

$T_2 = T_1\left(\dfrac{V_1}{V_2}\right)^{2/3} = 300 \times 8^{2/3} = 300 \times 4 =$ **1200 K**.

From $PV^\gamma$ = constant: $\dfrac{P_2}{P_1} = 8^{5/3} = 2^5 =$ **32 times**.
:::

:::question{title="7. Adiabatic expansion work" exam="NEET level"}
2 mol of an ideal monatomic gas expands adiabatically, and its temperature falls from 400 K to 300 K. Find the work done by the gas and the change in internal energy.

---

$W = \dfrac{\mu R(T_1 - T_2)}{\gamma - 1} = \dfrac{2 \times 8.31 \times 100}{2/3} =$ **2493 J**.

$\Delta Q = 0$, so $\Delta U = -W =$ **−2493 J** (the gas cools).
:::

## Cycles and the Carnot engine

:::question{title="8. Rectangular cycle" exam="JEE Main level"}
A gas is taken round a rectangle on a P–V graph ($P$ on the vertical axis, $V$ on the horizontal axis). The pressures are $1 \times 10^5$ Pa and $3 \times 10^5$ Pa, and the volumes are 2 L and 5 L. The loop is traversed **clockwise**. Find the net work done by the gas and the net heat it absorbs per cycle.

---

Net work = area of the loop $= \Delta P \times \Delta V = (2 \times 10^5) \times (3 \times 10^{-3}) = 600$ J. Clockwise means positive work by the gas: **+600 J**.

In a cycle $\Delta U = 0$, so the net heat absorbed is also **600 J**.
:::

:::question{title="9. Carnot engine" exam="NEET level"}
A Carnot engine works between 527 °C and 127 °C. (a) Find its efficiency. (b) Keeping the sink at 127 °C, to what temperature must the source be raised for an efficiency of 60%?

---

(a) $T_1 = 800$ K, $T_2 = 400$ K. $\eta = 1 - \dfrac{400}{800} =$ **50%**.

(b) $0.6 = 1 - \dfrac{400}{T_1}$, so $T_1 = \dfrac{400}{0.4} = 1000$ K $=$ **727 °C**.
:::

:::question{title="10. Gas with P proportional to V" exam="JEE Main level"}
1 mol of an ideal diatomic gas is heated so that its pressure stays proportional to its volume ($P = kV$). Find its molar heat capacity for this process.

---

Work: $W = \int kV\,dV = \tfrac12 k(V_2^2 - V_1^2) = \tfrac12(P_2V_2 - P_1V_1) = \tfrac12 R\,\Delta T$.

$\Delta U = C_v\Delta T = \tfrac52 R\,\Delta T$.

$\Delta Q = \Delta U + W = \left(\tfrac52 + \tfrac12\right)R\,\Delta T = 3R\,\Delta T$.

So $C = \dfrac{\Delta Q}{\Delta T} =$ **3R** (about 24.9 J mol⁻¹ K⁻¹).
:::
