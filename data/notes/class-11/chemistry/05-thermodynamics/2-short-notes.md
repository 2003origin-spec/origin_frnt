---
title: "Chemical Thermodynamics: Short Notes"
type: short_notes
chapter: c11.chemistry.thermodynamics
order: 2
---

## 1. What thermodynamics does

- It studies **energy changes** (heat and work) in **macroscopic** systems, using bulk properties like $p$, $V$, $T$.
- It looks only at the **initial and final states**. It says nothing about **how fast** a change happens.

## 2. System and surroundings

- **System:** the part we study (the reaction mixture in a beaker). **Surroundings:** the rest of the universe that can interact with it. The **boundary** (real or imaginary) separates them.
- System + surroundings = universe.

| System | Exchanges energy? | Exchanges matter? |
| --- | --- | --- |
| Open (reactants in an open beaker) | Yes | Yes |
| Closed (reactants in a sealed copper or steel vessel) | Yes | No |
| Isolated (reactants in a thermos flask) | No | No |

## 3. State functions and properties

- **State functions** ($p$, $V$, $T$, $U$, $H$, $S$, $G$) depend only on the state, not on how it was reached. **Path functions** ($q$, $w$) depend on how the change is carried out.
- **Extensive** properties depend on the amount of matter: mass, volume, $U$, $H$, $S$, $G$, heat capacity.
- **Intensive** properties do not: temperature, pressure, density, and every **molar** property (molar volume, molar heat capacity).

## 4. Internal energy, work and heat

- **Internal energy $U$:** the total energy of the system. We can measure only $\Delta U$, never the absolute $U$. It changes when heat flows, work is done, or matter enters or leaves.
- **Joule's experiment:** in an insulated (adiabatic) flask, the same amount of work, done in any way, gives the same temperature rise. So $\Delta U = w_{ad}$, and $U$ is a state function.
- **Heat $q$:** energy transferred because of a temperature difference. **Adiabatic:** no heat flows ($q = 0$); the temperature can still change.

**Sign convention (NCERT Chemistry, IUPAC):** anything **added to** the system is positive. Heat absorbed: $q > 0$. Work done on the system: $w > 0$.

## 5. First law of thermodynamics

$$\Delta U = q + w$$

- The energy of an **isolated** system is constant (conservation of energy). $q$ and $w$ depend on the path; their sum $\Delta U$ does not.

:::trap
NCERT **Physics** writes the first law as $\Delta Q = \Delta U + \Delta W$, where $\Delta W$ is work done **by** the gas. So expansion work is **positive** in Physics and **negative** in Chemistry. In these notes, always use $\Delta U = q + w$ with $w$ = work done **on** the system.
:::

## 6. Pressure–volume work

- **Constant external pressure (one step):** $w = -p_{ex}\Delta V$. Compression ($\Delta V < 0$) gives $w > 0$. Expansion gives $w < 0$.
- **Several finite steps:** $w = -\sum p\,\Delta V$. More steps means less work to compress the gas. On a $p$–$V$ graph, work is the **area** under the curve.
- **Reversible process:** $p_{ex}$ differs from the gas pressure by only $dp$ at every stage, so it goes infinitely slowly through equilibrium states and can be reversed at any moment by an infinitesimal change. Then $w_{rev} = -\int p\,dV$. Every other process is **irreversible**.

| Process (ideal gas) | $w$ | $q$ | $\Delta U$ |
| --- | --- | --- | --- |
| Free expansion (into vacuum) | 0 | 0 | 0 |
| Isothermal, constant $p_{ex}$ | $-p_{ex}\Delta V$ | $p_{ex}\Delta V$ | 0 |
| Isothermal, reversible | $w_{rev}$ (below) | $-w$ | 0 |
| Adiabatic | $\Delta U$ | 0 | $w_{ad}$ |
| Constant volume | 0 | $q_V$ | $q_V$ |

For the reversible isothermal row:

$$w_{rev} = -2.303\,nRT\log\frac{V_f}{V_i}$$

## 7. Enthalpy

- Most reactions run at **constant (atmospheric) pressure**, so we define $H = U + pV$. Then $\Delta H = q_p$ (while $\Delta U = q_V$).
- $\Delta H < 0$: **exothermic**. $\Delta H > 0$: **endothermic**.
- $\Delta H = \Delta U + \Delta n_g RT$. The difference matters only when **gases** are involved; for solids and liquids $\Delta H \approx \Delta U$.

## 8. Heat capacity

- $q = C\Delta T$. A large $C$ (like water's) means a small temperature rise. **Molar heat capacity** $C_m = C/n$ (per mol); **specific heat** $c$ (per unit mass), so $q = c \times m \times \Delta T$.
- For an ideal gas, $C_p - C_V = R$. $C_p$ is larger: at constant pressure some heat also goes into expansion work.

## 9. Calorimetry

| Calorimeter | Condition | Measures |
| --- | --- | --- |
| Bomb calorimeter (sealed steel bomb in water) | Constant volume | $\Delta U$ ($= q_V$) |
| Open calorimeter (at atmospheric pressure) | Constant pressure | $\Delta H$ ($= q_p$) |

- In a bomb calorimeter, $\Delta V = 0$, so **no work** is done even if gases form.
- Heat given out by the reaction = heat taken in by the calorimeter: $q_{reaction} = -C_{cal}\Delta T$. NCERT: 1 g graphite, $C$ = 20.7 kJ/K, rise 1 K gives $\Delta U = -20.7$ kJ/g $= -248$ kJ/mol ($= \Delta H$, as $\Delta n_g = 0$).

## 10. Reaction enthalpy and standard states

- $\Delta_r H$ = (sum of enthalpies of products) − (sum of enthalpies of reactants).
- **Standard state** of a substance at a given temperature: its **pure form at 1 bar**. Example: pure liquid ethanol at 1 bar. Data are usually for 298 K. A ° on the symbol ($\Delta H^\circ$) means standard state.
- **Thermochemical equation:** a balanced equation with its $\Delta_r H$ and the state (and allotrope) of every substance. Coefficients mean **moles**. $\Delta_r H$ (kJ mol⁻¹) is "per mole of reaction" as written: halve the equation, halve $\Delta_r H$; reverse it, change the sign.

## 11. Phase changes

| Change | Symbol | Water / example (NCERT) |
| --- | --- | --- |
| Melting (1 mol solid) | $\Delta_{fus}H^\circ$ | 6.00 kJ/mol at 273 K |
| Vaporisation (1 mol liquid) | $\Delta_{vap}H^\circ$ | 40.79 kJ/mol at 373 K |
| Sublimation (1 mol solid to vapour) | $\Delta_{sub}H^\circ$ | Dry ice 25.2 kJ/mol at 195 K |

- All three are **endothermic**; the reverse changes give out the same heat. Temperature stays constant during the change.
- Stronger intermolecular forces give larger values: water (hydrogen bonds) needs more heat to vaporise than acetone.

## 12. Standard enthalpy of formation

- $\Delta_f H^\circ$: enthalpy change when **1 mol** of a compound forms from its **elements in their reference states**.
- **Reference state:** the element's most stable form at 25 °C and 1 bar: $\ce{H2(g)}$, $\ce{O2(g)}$, C (graphite), S (rhombic), $\ce{Br2(l)}$. Its $\Delta_f H^\circ$ is **zero** by convention.
- Products minus reactants, using $\Delta_f H^\circ$ values. NCERT example: $\ce{CaCO3 -> CaO + CO2}$ gives $-635.1 - 393.5 + 1206.9 = +178.3$ kJ/mol, so it needs heating.

## 13. Hess's law of constant heat summation

Because $H$ is a state function, $\Delta_r H$ is the same whether the reaction happens in one step or many. Add the steps, and add their $\Delta H$ values.

NCERT example ($\ce{CO}$ can't be made pure from carbon directly, as some $\ce{CO2}$ always forms):

$$\ce{C(graphite) + O2 -> CO2}\quad -393.5$$

$$\ce{CO2 -> CO + 1/2 O2}\quad +283.0$$

Adding: $\ce{C(graphite) + 1/2 O2 -> CO}$, $\Delta_r H^\circ = -110.5$ kJ/mol.

## 14. Named enthalpies

- **Combustion** $\Delta_c H^\circ$: per mole burnt completely; always negative. Butane $-2658$, glucose $-2802$ kJ/mol.
- **Atomisation** $\Delta_a H^\circ$: all bonds broken to give gaseous atoms. $\ce{CH4}$: 1665 kJ/mol. For Na it equals the enthalpy of sublimation (108.4 kJ/mol).
- **Bond dissociation enthalpy:** one mole of a particular bond broken in the gas phase. For a diatomic molecule it equals the atomisation enthalpy (H–H 435.0, Cl–Cl 242 kJ/mol).
- **Mean bond enthalpy:** the four C–H bonds of $\ce{CH4}$ break with different energies (427, 439, 452, 347 kJ/mol), so we use the average, $1665/4 \approx 416$ kJ/mol.
- **Lattice enthalpy:** 1 mol of ionic solid to gaseous ions (NaCl: +788 kJ/mol). Found indirectly from a **Born–Haber cycle** (the total round a cycle is zero).
- **Solution:** $\Delta_{sol}H^\circ = \Delta_{lattice}H^\circ + \Delta_{hyd}H^\circ$. Positive for most salts, so their solubility rises with temperature.
- **Dilution:** heat change when more solvent is added. It depends on the starting concentration and the amount added.

## 15. Spontaneity

- A **spontaneous** process can happen **without outside help**. It says nothing about speed: $\ce{H2}$ and $\ce{O2}$ react spontaneously but extremely slowly. It is **irreversible**; only an outside agency can reverse it.
- **$\Delta H < 0$ is not enough.** Some endothermic reactions are spontaneous: $\ce{1/2N2 + O2 -> NO2}$ (+33.2 kJ/mol), $\ce{C + 2S -> CS2}$ (+128.5 kJ/mol). Two gases mixing in an isolated box ($\Delta H = 0$) is spontaneous too. The extra driver is entropy.

## 16. Entropy and the second and third laws

- **Entropy $S$:** a measure of disorder or randomness. It is a state function.
- For a given substance: solid < liquid < gas. Entropy rises with temperature and with the number of particles (moles of gas).
- $\Delta S = q_{rev}/T$. The same heat causes more disorder at a **lower** temperature.
- **Second law:** for a spontaneous process, $\Delta S_{total} = \Delta S_{sys} + \Delta S_{surr} > 0$. At equilibrium, $\Delta S_{total} = 0$.
- Exothermic reactions are often spontaneous because the heat they release raises the entropy of the **surroundings**.
- **Third law:** the entropy of a **pure, perfect crystal** approaches **zero** as $T$ approaches 0 K. This lets us find **absolute** entropies from heat data.

## 17. Gibbs energy

- $G = H - TS$, a state function and extensive. At constant $T$: $\Delta G = \Delta H - T\Delta S$.
- At constant $T$ and $p$: $\Delta G < 0$ spontaneous, $\Delta G > 0$ non-spontaneous, $\Delta G = 0$ equilibrium.
- $-\Delta G$ is the energy free to do useful work, so $G$ is also called **free energy**. $T\Delta S$ is the part not available for useful work.

| $\Delta H$ | $\Delta S$ | Spontaneous when |
| --- | --- | --- |
| − | + | At all temperatures |
| − | − | At low temperature |
| + | + | At high temperature |
| + | − | Never |

"Low" and "high" are relative: for some reactions, "high" can mean room temperature.

## 18. Gibbs energy and equilibrium

- At equilibrium, $\Delta_r G = 0$, and $G$ of the system is at its **minimum**.
- $\Delta_r G^\circ = -RT\ln K = -2.303\,RT\log K$.
- Large negative $\Delta_r G^\circ$ (often strongly exothermic): $K \gg 1$, the reaction goes nearly to completion. Large positive $\Delta_r G^\circ$: $K \ll 1$, little product.
- From $\Delta H^\circ$ and $\Delta S^\circ$ we get $\Delta G^\circ$, and then $K$, at any temperature. NCERT: $\Delta_r G^\circ = -13.6$ kJ/mol at 298 K gives $K \approx 2.4 \times 10^2$.
