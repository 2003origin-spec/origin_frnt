---
title: "Chemical Thermodynamics: Important Points and Traps"
type: key_points
chapter: c11.chemistry.thermodynamics
order: 3
---

## Signs of q and w

:::trap
**Chemistry and Physics use opposite signs for work.**
- Chemistry (NCERT Chemistry, IUPAC): $\Delta U = q + w$, $w$ = work done **on** the system. Expansion: $w < 0$.
- Physics (NCERT Physics): $\Delta Q = \Delta U + \Delta W$, $\Delta W$ = work done **by** the system. Expansion: $\Delta W > 0$.

"A gas absorbs 100 J and does 40 J of work": Chemistry gives $q = +100$, $w = -40$, $\Delta U = +60$ J. Physics gives the same $\Delta U$. Only the sign of the work term differs.
:::

- When a question says "$w$ amount of work is done **by** the system", put $-w$ into $\Delta U = q + w$. NCERT's own worked answer for this case is $\Delta U = q - w$.
- In $w = -p_{ex}\Delta V$, use the **external** pressure. For expansion into a vacuum, $p_{ex} = 0$, so $w = 0$ however large $\Delta V$ is.

:::trap
**Adiabatic means $q = 0$, not $\Delta T = 0$.** In an adiabatic expansion against a pressure, the gas does work using its own internal energy, so it **cools**. (Exception: an ideal gas expanding into a vacuum does no work and does not cool.) Constant temperature is "isothermal".
:::

## ΔH and ΔU

- $\Delta H = \Delta U + \Delta n_g RT$. Count **only gases**. Liquid water does not count.
- $\Delta n_g < 0$: $\Delta H < \Delta U$. Combustion of methane, $\ce{CH4(g) + 2O2(g) -> CO2(g) + 2H2O(l)}$, has $\Delta n_g = 1 - 3 = -2$, so $\Delta H$ is **more negative** than $\Delta U$.
- $\Delta n_g = 0$ (for example $\ce{C(graphite) + O2 -> CO2}$, or $\ce{H2 + Cl2 -> 2HCl}$): $\Delta H = \Delta U$.

:::trap
$R$ is in **J**, but $\Delta H$ is usually in **kJ**. $\Delta n_g RT$ at 298 K is only $\Delta n_g \times 2.48$ kJ/mol. If your correction comes out as 2478 kJ, you forgot to divide by 1000.
:::

## Enthalpy of formation

:::trap
$\Delta_f H^\circ = 0$ only for an element in its **reference state**:
- graphite, not diamond;
- $\ce{O2(g)}$, not $\ce{O3}$ or $\ce{O(g)}$;
- $\ce{Br2(l)}$, not $\ce{Br2(g)}$;
- rhombic sulphur, not monoclinic.
- (Exam extra) For phosphorus, **white** phosphorus is taken as the reference by convention, even though red is more stable.
:::

- A formation equation makes **exactly 1 mol** of product from **elements**. $\ce{H2 + Br2 -> 2HBr}$ gives $2\Delta_f H^\circ$. $\ce{CaO + CO2 -> CaCO3}$ is not a formation reaction at all.
- Some compounds have a **positive** $\Delta_f H^\circ$: liquid benzene, about +49 kJ/mol. In NCERT Problem 5.9, the final line is printed as $-48.51$ kJ/mol, but the working gives a **plus** sign: reversing the combustion step gives $+3267.0$, and $-3218.49 + 3267.0 = +48.51$ kJ/mol. Use **+48.51 kJ/mol**.

## Hess's law and bond enthalpies

- Keep the physical states the same in every Hess's law step: $\ce{H2O(l)}$ and $\ce{H2O(g)}$ differ by 44 kJ/mol at 298 K.
- Formation data: **products − reactants**. Bond enthalpy data: **reactants − products** (bonds broken − bonds formed).

:::trap
The bond-enthalpy method works only when **every** species is a **gas**. If water forms as a liquid, add its enthalpy of condensation separately. The answer is an estimate, because mean bond enthalpies vary from molecule to molecule.
:::

:::trap
**Lattice enthalpy sign.** NCERT defines it for **breaking** the solid into gaseous ions, so it is **positive** (NaCl: +788 kJ/mol). Some books define "lattice energy" for **forming** the solid, which makes it negative. Read the definition in the question. The lattice internal energy of NaCl is $788 - 2RT \approx 783$ kJ/mol ($\Delta n_g = 2$).
:::

## Spontaneity

:::remember
- Spontaneous does **not** mean fast. $\ce{H2}$ and $\ce{O2}$ can stay mixed for years.
- A spontaneous process is irreversible. It is reversed only by an outside agency.
- Exothermic is **not** the test of spontaneity. $\ce{1/2N2 + O2 -> NO2}$ is endothermic and still spontaneous.
:::

- The test is $\Delta S_{total} > 0$ (any system) or $\Delta G_{sys} < 0$ (at constant $T$ and $p$). $\Delta S_{sys}$ alone is **not** the test: rusting of iron has $\Delta S_{sys} = -549.4$ J K⁻¹ mol⁻¹ but is spontaneous, because $\Delta S_{surr} = +1648000/298 \approx +5530$ J K⁻¹ mol⁻¹.

:::trap
**Mixing units in $\Delta G = \Delta H - T\Delta S$.** $\Delta H$ is in kJ, $\Delta S$ in J K⁻¹. Convert one before you subtract. $\Delta H = +400$ kJ, $\Delta S = +0.2$ kJ K⁻¹ (= 200 J K⁻¹): spontaneous above $T = 400/0.2 = 2000$ K.
:::

## Entropy

- Entropy increases: solid → liquid → gas; heating; more moles of gas formed; one molecule breaking into atoms ($\ce{H2 -> 2H}$); a solid giving gases ($\ce{2NaHCO3 -> Na2CO3 + CO2 + H2O}$).
- Entropy decreases: a liquid crystallising; atoms joining ($\ce{2Cl(g) -> Cl2(g)}$: $\Delta S < 0$, and $\Delta H < 0$ because a bond forms).
- $\Delta S = q_{rev}/T$ needs the **reversible** heat. For an irreversible path, find a reversible path between the same two states and use that.
- For an ideal gas expanding isothermally, $\Delta U = 0$ by either path, but $\Delta S_{total} > 0$ only for the irreversible path.

:::remember
**Third law:** $S \to 0$ as $T \to 0$ K only for a **pure, perfectly crystalline** substance. Solutions and supercooled liquids keep some entropy at 0 K.
:::

## Gibbs energy and K

- $\Delta G^\circ$ and $\Delta G$ are different. $\Delta G = 0$ means equilibrium. $\Delta G^\circ = 0$ means $K = 1$.
- $\Delta G^\circ < 0$ means $K > 1$ (products favoured), not "the reaction is complete".
- $K$ close to 1 means $\Delta G^\circ$ close to 0. NCERT Problem 5.14 ($\ce{N2O4}$, 50% dissociated at 333 K) gets $K_p \approx 1.33$; its own working then gives $\Delta_r G^\circ \approx -790$ J/mol $\approx -0.79$ kJ/mol. The printed final line shows $-763.8$ kJ mol⁻¹, which does not follow from the working; use about $-0.8$ kJ/mol.
- In $\Delta G^\circ = -2.303\,RT\log K$, use $R$ = 8.314 J K⁻¹ mol⁻¹ and get $\Delta G^\circ$ in **J** mol⁻¹. $T$ must be in **kelvin**.

:::tip
**Sign table in one line:** $\Delta H$ and $\Delta S$ helping (−, +) → always spontaneous; both against (+, −) → never; one each → **temperature decides**. High $T$ favours the side where $\Delta S$ is positive.
:::

:::tip
Remember $2.303\,RT \approx 5.71$ kJ/mol at 298 K. Then $\log K = -\Delta G^\circ / 5.71$ (in kJ/mol). Example: $\Delta G^\circ = -11.4$ kJ/mol gives $\log K \approx 2$, $K \approx 100$.
:::

## NCERT lines to know

:::remember
- First law: the energy of an isolated system stays constant.
- $\Delta H = q_p$; $\Delta U = q_V$. A bomb calorimeter measures $\Delta U$.
- All enthalpies of fusion, vaporisation and sublimation are positive.
- The standard state of a substance is its pure form at 1 bar (at the stated temperature).
- $G$ is an extensive property and a state function.
- At equilibrium the Gibbs energy of the system is at its minimum.
:::
