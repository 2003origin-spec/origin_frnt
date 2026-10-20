---
title: "Chemical Thermodynamics: Formula Sheet"
type: formula_sheet
chapter: c11.chemistry.thermodynamics
order: 1
---

## Sign convention used here

These notes follow NCERT Chemistry (the IUPAC convention):
- $q$ is **positive** when heat goes **into** the system.
- $w$ is **positive** when work is done **on** the system (compression). Expansion work is negative.

:::trap
NCERT **Physics** uses the opposite sign for work: $\Delta Q = \Delta U + \Delta W$, where $\Delta W$ is work done **by** the system. So $w_{\text{chem}} = -\Delta W_{\text{phys}}$. Both give the same $\Delta U$. Check which convention a question uses before you put in signs.
:::

## First law

:::formula{title="First law of thermodynamics"}
$$\Delta U = q + w$$
$q$ = heat absorbed by the system, $w$ = work done on the system (all in J). Holds for any process in a **closed** system (no matter enters or leaves). $\Delta U$ is a state function; $q$ and $w$ depend on the path.
:::

:::formula{title="Special cases"}
Isolated ($q = w = 0$): $\Delta U = 0$. Adiabatic ($q = 0$): $\Delta U = w_{ad}$. Constant volume, only pV work: $\Delta U = q_V$.
:::

## Pressure–volume work

:::formula{title="Work against a constant external pressure"}
$$w = -p_{ex}\,\Delta V = -p_{ex}(V_f - V_i)$$
Use the **external** pressure, not the gas pressure. Valid when $p_{ex}$ stays constant (one-step, irreversible). In finite steps: $w = -\sum p\,\Delta V$.

Units: 1 L bar = 100 J; 1 L atm = 101.3 J.
:::

:::formula{title="Reversible work"}
$$w_{rev} = -\int_{V_i}^{V_f} p\,dV$$
Only for a **reversible** change ($p_{ex}$ = gas pressure ± $dp$ at every stage).
:::

:::formula{title="Isothermal reversible expansion of an ideal gas"}
$$w_{rev} = -nRT\ln\frac{V_f}{V_i}$$
$$w_{rev} = -2.303\,nRT\log\frac{V_f}{V_i}$$
$R$ = 8.314 J K⁻¹ mol⁻¹, $T$ in K. $V_f/V_i = p_i/p_f$ (Boyle's law). Expansion gives $w < 0$.
:::

:::formula{title="Isothermal change of an ideal gas"}
$$\Delta U = 0$$
$$q = -w$$
Irreversible (constant $p_{ex}$): $q = p_{ex}(V_f - V_i)$. Reversible: $q = 2.303\,nRT\log(V_f/V_i)$.

**Free expansion** (into vacuum, $p_{ex} = 0$): $w = 0$, and for an ideal gas $q = 0$ and $\Delta U = 0$.
:::

:::formula{title="Adiabatic change of an ideal gas"}
$$w_{ad} = \Delta U$$
$$\Delta U = nC_{V,m}\,\Delta T$$
$w_{ad} = \Delta U$ is in NCERT (since $q = 0$). $\Delta U = nC_{V,m}\Delta T$ is an exam extra (ideal gas only); $C_{V,m}$ = molar heat capacity at constant volume. An adiabatic expansion that does work cools the gas; compression warms it. Exception: free expansion into a vacuum does no work, so an ideal gas does not cool.
:::

## Enthalpy

:::formula{title="Enthalpy"}
$$H = U + pV$$
$$\Delta H = q_p$$
$H$ is a state function. $\Delta H = q_p$ needs constant pressure and only pV work. Exothermic: $\Delta H < 0$. Endothermic: $\Delta H > 0$.
:::

:::formula{title="ΔH and ΔU"}
$$\Delta H = \Delta U + p\,\Delta V$$
$$\Delta H = \Delta U + \Delta n_g RT$$
$\Delta n_g$ = moles of **gaseous** products − moles of **gaseous** reactants, from the balanced equation. Assumes ideal gases at constant $T$ and $p$; the volume of solids and liquids is ignored. If $\Delta n_g = 0$ (or no gases), $\Delta H = \Delta U$.
:::

## Heat capacity

:::formula{title="Heat and temperature rise"}
$$q = C\,\Delta T$$
$$q = c \times m \times \Delta T$$
$C$ = heat capacity (J K⁻¹), $c$ = specific heat (J g⁻¹ K⁻¹), $C_m = C/n$. Only when there is **no phase change**.
:::

:::formula{title="Cp and CV of an ideal gas"}
$$q_V = C_V\,\Delta T = \Delta U$$
$$q_p = C_p\,\Delta T = \Delta H$$
$$C_p - C_V = R$$
$C_p - C_V = R$ is for **molar** heat capacities of an **ideal gas**. For solids and liquids $C_p \approx C_V$.
:::

## Reaction enthalpies

:::formula{title="From enthalpies of formation"}
$$\begin{aligned} \Delta_r H^\circ = {} & \textstyle\sum a_i\,\Delta_f H^\circ(\text{products}) \\ & - \textstyle\sum b_i\,\Delta_f H^\circ(\text{reactants}) \end{aligned}$$
$a_i$, $b_i$ = coefficients. $\Delta_f H^\circ = 0$ for an element in its **reference state** (most stable form at 25 °C, 1 bar). ° = standard state: pure substance at 1 bar.
:::

:::formula{title="Hess's law"}
$$\Delta_r H = \Delta_r H_1 + \Delta_r H_2 + \Delta_r H_3 + \dots$$
Steps at the same temperature. Reverse an equation: change the sign. Multiply it by $k$: multiply $\Delta_r H$ by $k$.
:::

:::formula{title="From bond enthalpies"}
$$\begin{aligned} \Delta_r H^\circ = {} & \textstyle\sum \text{B.E.(reactants)} \\ & - \textstyle\sum \text{B.E.(products)} \end{aligned}$$
Approximate, and only when **all** species are **gases**. Order: reactants − products (opposite of the formation formula).
:::

:::formula{title="Mean bond enthalpy"}
$$\Delta_{C-H}H = \tfrac14\,\Delta_a H(\ce{CH4})$$
$\tfrac14(1665) \approx 416$ kJ mol⁻¹. For a diatomic molecule, enthalpy of atomisation = bond dissociation enthalpy.
:::

:::formula{title="Enthalpy of solution"}
$$\Delta_{sol}H^\circ = \Delta_{lattice}H^\circ + \Delta_{hyd}H^\circ$$
For NaCl: $+788 - 784 = +4$ kJ mol⁻¹. NCERT's lattice enthalpy is for **breaking** the solid into gaseous ions, so it is positive.
:::

:::formula{title="Born–Haber cycle for NaCl"}
$$\begin{aligned} \Delta_{lattice}H = {} & -\Delta_f H + \Delta_{sub}H + \Delta_i H \\ & + \tfrac12\Delta_{bond}H + \Delta_{eg}H \end{aligned}$$
NCERT: $411.2 + 108.4 + 496 + 121 - 348.6 = 788$ kJ mol⁻¹.
:::

:::formula{title="Ionisation and electron gain enthalpy (NCERT box)"}
$$\Delta_i H = E_0 + \tfrac52 RT$$
$$\Delta_{eg}H = -A - \tfrac52 RT$$
$E_0$ = ionisation energy, $A$ = electron affinity (both defined at 0 K).
:::

## Entropy

:::formula{title="Entropy change"}
$$\Delta S = \frac{q_{rev}}{T}$$
J K⁻¹ (or J K⁻¹ mol⁻¹). For heat taken in at a **constant temperature** $T$ (K). Use the heat of a **reversible** path. $\Delta S$ itself is the same for any path (state function).
:::

:::formula{title="Phase change at its transition temperature"}
$$\Delta S = \frac{\Delta H_{trans}}{T_{trans}}$$
Follows from $\Delta S = q_{rev}/T$. Only at the equilibrium melting or boiling point.
:::

:::formula{title="Total entropy change"}
$$\Delta S_{total} = \Delta S_{sys} + \Delta S_{surr}$$
$$\Delta S_{surr} = -\frac{\Delta H_{sys}}{T}$$
$\Delta S_{surr}$ formula: surroundings at the same $T$, constant pressure. Spontaneous: $\Delta S_{total} > 0$. Equilibrium: $\Delta S_{total} = 0$.
:::

:::formula{title="Isothermal expansion of an ideal gas (exam extra)"}
$$\Delta S = nR\ln\frac{V_f}{V_i}$$
Same value for the reversible and the irreversible path (state function).
:::

## Gibbs energy

:::formula{title="Gibbs energy"}
$$G = H - TS$$
$$\Delta G = \Delta H - T\Delta S$$
$\Delta G = \Delta H - T\Delta S$ is at **constant $T$**. At constant $T$ and $p$: $\Delta G < 0$ spontaneous, $> 0$ non-spontaneous, $= 0$ equilibrium. $-\Delta G$ = energy available for useful work.
:::

:::formula{title="Crossover temperature"}
$$T = \frac{\Delta H}{\Delta S}$$
Where $\Delta G = 0$. Only when $\Delta H$ and $\Delta S$ have the **same sign**; assumes both are constant with $T$. Use J with J K⁻¹.
:::

:::formula{title="Gibbs energy and equilibrium constant"}
$$\Delta_r G^\circ = -RT\ln K$$
$$\Delta_r G^\circ = -2.303\,RT\log K$$
$$\Delta_r G^\circ = \Delta_r H^\circ - T\Delta_r S^\circ$$
$T$ in K. $K > 1$ when $\Delta_r G^\circ < 0$; $K < 1$ when $\Delta_r G^\circ > 0$.
:::

:::formula{title="Non-standard conditions (NCERT Unit 6)"}
$$\Delta_r G = \Delta_r G^\circ + RT\ln Q$$
Not in this unit; NCERT gives it in Unit 6, Equilibrium. $Q$ = reaction quotient. At equilibrium $\Delta_r G = 0$ and $Q = K$, which gives $\Delta_r G^\circ = -RT\ln K$.
:::

## Useful values

| Quantity | Value |
| --- | --- |
| $R$ | 8.314 J K⁻¹ mol⁻¹ = 0.08206 L atm K⁻¹ mol⁻¹ |
| $RT$ at 298 K | 2.48 kJ mol⁻¹ |
| $2.303\,RT$ at 298 K | 5.71 kJ mol⁻¹ |
| $\Delta_{fus}H$ (ice, 273 K) | 6.00 kJ mol⁻¹ |
| $\Delta_{vap}H$ (water, 373 K) | 40.79 kJ mol⁻¹ |
