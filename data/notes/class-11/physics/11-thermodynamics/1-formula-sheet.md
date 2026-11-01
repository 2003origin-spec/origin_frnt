---
title: "Thermodynamics: Formula Sheet"
type: formula_sheet
chapter: c11.physics.thermodynamics
order: 1
---

## Sign convention used here

These notes follow NCERT Physics:
- $\Delta Q$ is **positive** when heat is **given to** the system.
- $\Delta W$ is the work done **by** the system (the gas). It is **positive** when the gas **expands**.
- $\Delta U$ is the change in internal energy.

:::trap
NCERT **Chemistry** uses the opposite sign for work: it writes $\Delta U = q + w$, where $w$ is the work done **on** the system. So $w_{\text{chem}} = -\Delta W_{\text{phys}}$. Both give the same $\Delta U$. Check which convention a question uses before you put in signs.
:::

## First law

:::formula{title="First law of thermodynamics"}
$$\Delta Q = \Delta U + \Delta W$$
$\Delta Q$ = heat supplied to the system (J), $\Delta U$ = change in internal energy (J), $\Delta W$ = work done by the system (J). Holds for every process, reversible or not.
:::

:::formula{title="Work done by a gas"}
$$\Delta W = P\,\Delta V$$
$$W = \int_{V_1}^{V_2} P\,dV$$
$P$ = pressure (Pa), $V$ = volume (m³). $P\,\Delta V$ needs the pressure to stay constant (or $\Delta V$ to be very small). The integral needs a **quasi-static** process, so that the gas has a definite $P$ at every stage. In general, $W$ = **area under the P–V curve**: positive for expansion, negative for compression.
:::

:::formula{title="Internal energy of an ideal gas"}
$$\Delta U = \mu C_v\,\Delta T$$
$\mu$ = number of moles, $C_v$ = molar specific heat at constant volume (J mol⁻¹ K⁻¹), $\Delta T$ = change in temperature (K). For an **ideal gas** $U$ depends on $T$ only, so this holds for **any** process, not just constant volume.
:::

## Specific heat capacity

:::formula{title="Heat capacity and specific heat"}
$$S = \frac{\Delta Q}{\Delta T}$$
$$s = \frac{1}{m}\frac{\Delta Q}{\Delta T}$$
$S$ = heat capacity (J K⁻¹), $s$ = specific heat capacity (J kg⁻¹ K⁻¹), $m$ = mass (kg). Water: $s \approx 4186$ J kg⁻¹ K⁻¹ (NCERT value). $1$ cal $= 4.186$ J.
:::

:::formula{title="Molar specific heat"}
$$C = \frac{1}{\mu}\frac{\Delta Q}{\Delta T}$$
Unit J mol⁻¹ K⁻¹. For a gas it depends on the process: $C_p$ at constant pressure, $C_v$ at constant volume.
:::

:::formula{title="Mayer's relation"}
$$C_p - C_v = R$$
Molar specific heats of an **ideal gas** only. $R$ = 8.31 J mol⁻¹ K⁻¹. Per unit mass: $c_p - c_v = R/M$, $M$ = molar mass (kg mol⁻¹).
:::

:::formula{title="Ratio of specific heats"}
$$\gamma = \frac{C_p}{C_v}$$
Always more than 1, because $C_p > C_v$ for a gas.
:::

| Gas (rigid molecules) | $C_v$ | $C_p$ | $\gamma$ |
| --- | --- | --- | --- |
| Monatomic | $\tfrac32 R$ | $\tfrac52 R$ | $\tfrac53 \approx 1.67$ |
| Diatomic | $\tfrac52 R$ | $\tfrac72 R$ | $\tfrac75 = 1.4$ |
| Polyatomic (non-linear) | $3R$ | $4R$ | $\tfrac43 \approx 1.33$ |

These values come from the law of equipartition (Chapter 12, Kinetic Theory). Diatomic values ignore vibration (true at ordinary temperatures).

## Equation of state

:::formula{title="Ideal gas equation"}
$$PV = \mu RT$$
$T$ in **kelvin**. Links the state variables $P$, $V$, $T$ of an ideal gas in equilibrium.
:::

## Thermodynamic processes (ideal gas, quasi-static)

:::formula{title="Isothermal (T constant)"}
$$PV = \text{constant}$$
$$W = \mu RT \ln\frac{V_2}{V_1}$$
$\Delta U = 0$, so $\Delta Q = W$. Also $W = \mu RT\ln\dfrac{P_1}{P_2}$.
:::

:::formula{title="Adiabatic (no heat exchange)"}
$$PV^\gamma = \text{constant}$$
$$TV^{\gamma - 1} = \text{constant}$$
$$P^{1-\gamma}\,T^{\gamma} = \text{constant}$$
$\Delta Q = 0$, so $\Delta W = -\Delta U$. Expansion cools the gas; compression heats it.
:::

:::formula{title="Work in an adiabatic process"}
$$W = \frac{\mu R(T_1 - T_2)}{\gamma - 1}$$
$$W = \frac{P_1V_1 - P_2V_2}{\gamma - 1}$$
$T_1$, $T_2$ = initial and final temperatures. Positive when the gas expands (and cools).
:::

:::formula{title="Isochoric (V constant)"}
$$\Delta W = 0$$
$$\Delta Q = \Delta U = \mu C_v\,\Delta T$$
All the heat goes into internal energy.
:::

:::formula{title="Isobaric (P constant)"}
$$W = P(V_2 - V_1) = \mu R\,\Delta T$$
$$\Delta Q = \mu C_p\,\Delta T$$
$\Delta U = \mu C_v\,\Delta T$, as always for an ideal gas.
:::

:::formula{title="Cyclic process"}
$$\Delta U = 0$$
$$\Delta Q_{\text{net}} = W_{\text{net}}$$
$W_{\text{net}}$ = area enclosed by the loop on a P–V graph ($P$ up, $V$ across): positive if the loop goes **clockwise**, negative if anticlockwise.
:::

## Carnot engine

:::formula{title="Efficiency of a heat engine"}
$$\eta = \frac{W}{Q_1} = 1 - \frac{Q_2}{Q_1}$$
$Q_1$ = heat taken from the hot reservoir per cycle, $Q_2$ = heat given to the cold reservoir per cycle, $W = Q_1 - Q_2$.
:::

:::formula{title="Carnot engine"}
$$\frac{Q_2}{Q_1} = \frac{T_2}{T_1}$$
$$\eta = 1 - \frac{T_2}{T_1}$$
$T_1$ = hot (source) temperature, $T_2$ = cold (sink) temperature, both in **kelvin**. Only for a reversible (Carnot) engine, with any working substance. No engine between the same two temperatures can do better. NCERT uses $Q_1/Q_2 = T_1/T_2$ to define the thermodynamic temperature scale.
:::

## Exam extras (formulas not given in the current NCERT chapter)

:::formula{title="Refrigerator and heat pump"}
$$\alpha = \frac{Q_2}{W} = \frac{Q_2}{Q_1 - Q_2}$$
$$\alpha_{\text{Carnot}} = \frac{T_2}{T_1 - T_2}$$
$\alpha$ = coefficient of performance (COP) of a refrigerator ($Q_2$ taken from the cold side; many books call it $\beta$). Heat pump: $\dfrac{Q_1}{W} = \alpha + 1$. NCERT still says a Carnot cycle run backwards is a reversible refrigerator, and that the second law makes $\alpha$ finite, but it no longer gives these formulas.
:::

:::formula{title="Slopes on a P–V graph"}
$$\text{Isothermal: } \frac{dP}{dV} = -\frac{P}{V}$$
$$\text{Adiabatic: } \frac{dP}{dV} = -\gamma\frac{P}{V}$$
At the same point the adiabatic curve is $\gamma$ times steeper. (NCERT only shows this in a figure: the adiabatic curve is steeper.) Bulk modulus: $P$ (isothermal), $\gamma P$ (adiabatic).
:::

:::formula{title="Polytropic process (JEE)"}
$$PV^n = \text{constant}$$
$$W = \frac{P_1V_1 - P_2V_2}{n - 1}$$
$$C = C_v + \frac{R}{1 - n}$$
$n \ne 1$. $n = 0$ isobaric, $n = 1$ isothermal, $n = \gamma$ adiabatic, $n \to \infty$ isochoric.
:::
