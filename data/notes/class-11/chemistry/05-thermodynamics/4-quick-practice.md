---
title: "Chemical Thermodynamics: Quick Practice"
type: practice
chapter: c11.chemistry.thermodynamics
order: 4
---

Try each question first, then tap **Show answer**. Signs follow NCERT Chemistry: $\Delta U = q + w$, with $w$ = work done **on** the system. Take $R = 8.314$ J K⁻¹ mol⁻¹.

## First law and work

:::question{title="1. Internal energy change" exam="NEET level"}
A system absorbs 500 J of heat and does 200 J of work on its surroundings. Find $\Delta U$.

---

Heat in: $q = +500$ J. Work done **by** the system: $w = -200$ J.

$\Delta U = q + w = 500 - 200 =$ **+300 J**.
:::

:::question{title="2. Work against constant pressure" exam="NEET level"}
A gas expands from 2.0 L to 7.0 L against a constant external pressure of 1.5 bar. Find the work done on the gas, in joules. (1 L bar = 100 J)

---

$w = -p_{ex}\Delta V = -(1.5)(7.0 - 2.0) = -7.5$ L bar.

$w = -7.5 \times 100 =$ **−750 J** (the gas does 750 J of work).
:::

:::question{title="3. Isothermal reversible expansion" exam="JEE Main level"}
2 mol of an ideal gas expand isothermally and reversibly at 300 K from 10 L to 100 L. Find $w$, $q$ and $\Delta U$.

---

$w = -2.303\,nRT\log\dfrac{V_f}{V_i} = -2.303 \times 2 \times 8.314 \times 300 \times \log 10$

$w = -11\,488$ J $\approx$ **−11.5 kJ**.

Isothermal ideal gas: **$\Delta U = 0$**, so $q = -w =$ **+11.5 kJ**.
:::

## Enthalpy

:::question{title="4. ΔH from a bomb calorimeter" exam="JEE Main level"}
For the combustion of propane at 298 K, $\Delta_c U = -2213.0$ kJ/mol:

$$\begin{aligned} & \ce{C3H8(g) + 5O2(g)} \\ & \ce{-> 3CO2(g) + 4H2O(l)} \end{aligned}$$

Find $\Delta_c H$.

---

Count only gases: $\Delta n_g = 3 - (1 + 5) = -3$.

$\Delta n_g RT = -3 \times 8.314 \times 10^{-3} \times 298 = -7.43$ kJ/mol.

$\Delta_c H = -2213.0 - 7.43 \approx$ **−2220.4 kJ/mol**. It is more negative than $\Delta U$, because the gas volume shrinks.
:::

:::question{title="5. Heating water" exam="NEET level"}
How much heat is needed to warm 36 g of liquid water from 25 °C to 75 °C? Molar heat capacity of water = 75.3 J K⁻¹ mol⁻¹.

---

$n = 36/18 = 2$ mol, $\Delta T = 50$ K.

$q = nC_m\Delta T = 2 \times 75.3 \times 50 = 7530$ J $=$ **7.53 kJ**.
:::

:::question{title="6. Formation from combustion data" exam="NEET level"}
Standard enthalpies of combustion: C (graphite) $-393.5$, $\ce{H2(g)}$ $-285.8$, $\ce{C2H6(g)}$ $-1560.0$ kJ/mol. Find $\Delta_f H^\circ$ of ethane.

---

Target: $\ce{2C(graphite) + 3H2(g) -> C2H6(g)}$.

Burn the elements, then reverse the combustion of ethane:

$\Delta_f H^\circ = 2(-393.5) + 3(-285.8) - (-1560.0)$

$= -787.0 - 857.4 + 1560.0 =$ **−84.4 kJ/mol**.
:::

:::question{title="7. Bond enthalpies" exam="JEE Main level"}
Estimate $\Delta_r H$ for $\ce{C2H4(g) + H2(g) -> C2H6(g)}$. Mean bond enthalpies (kJ/mol): C=C 611, C–C 347, C–H 414, H–H 436.

---

Bonds broken: C=C, 4 C–H, H–H $= 611 + 4(414) + 436 = 2703$.

Bonds formed: C–C, 6 C–H $= 347 + 6(414) = 2831$.

$\Delta_r H = 2703 - 2831 =$ **−128 kJ/mol** (broken − formed).
:::

## Entropy and Gibbs energy

:::question{title="8. Sign of ΔS" exam="NEET level"}
Which process has a **negative** entropy change?

- (a) $\ce{H2O(s) -> H2O(l)}$
- (b) $\ce{CaCO3(s) -> CaO(s) + CO2(g)}$
- (c) $\ce{2Cl(g) -> Cl2(g)}$
- (d) $\ce{H2(g) -> 2H(g)}$

---

**(c)**. Two gaseous atoms join into one molecule, so the number of particles falls and disorder decreases. (a) solid to liquid, (b) a gas forms from a solid, and (d) one molecule gives two atoms: all three increase entropy.
:::

:::question{title="9. When does limestone decompose?" exam="NEET level"}
For $\ce{CaCO3(s) -> CaO(s) + CO2(g)}$, $\Delta H^\circ = +178.3$ kJ/mol and $\Delta S^\circ = +160$ J K⁻¹ mol⁻¹. Assuming both stay constant, above what temperature is the reaction spontaneous?

---

Both are positive, so it becomes spontaneous at high $T$, when $T\Delta S > \Delta H$.

$T = \dfrac{\Delta H}{\Delta S} = \dfrac{178\,300}{160} \approx 1114$ K.

Spontaneous above about **1114 K** (convert kJ to J first).
:::

:::question{title="10. ΔG° and K" exam="JEE Main level"}
For a gas reaction at 300 K, $\Delta H^\circ = -20.0$ kJ/mol and $\Delta S^\circ = -30.0$ J K⁻¹ mol⁻¹. Find $\Delta G^\circ$ and $K$.

---

$\Delta G^\circ = \Delta H^\circ - T\Delta S^\circ = -20\,000 - 300(-30.0) = -11\,000$ J/mol $=$ **−11.0 kJ/mol**.

$\log K = \dfrac{-\Delta G^\circ}{2.303RT} = \dfrac{11\,000}{2.303 \times 8.314 \times 300} = \dfrac{11\,000}{5744} \approx 1.915$

$K = 10^{1.915} \approx$ **82**.
:::
