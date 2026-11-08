---
title: "Solutions: Important Points and Traps"
type: key_points
chapter: c12.chemistry.solutions
order: 3
---

## Concentration

:::trap
**Molality uses the mass of the solvent, not of the solution.** 10 g of glucose in 90 g of water: divide by 0.090 kg, not 0.100 kg. **Molarity uses the volume of the solution**, not of the solvent.
:::

- Molarity changes with temperature; molality, mole fraction, mass % and ppm do not. For work at different temperatures (boiling and freezing points), molality is used.
- For very dilute **aqueous** solutions (density about 1 g/mL), molarity ≈ molality. For other solvents or concentrated solutions they differ.
- Mole fractions of all components always add up to 1. If you know $x_2$, then $x_1 = 1 - x_2$.

:::tip
1 kg of water = 55.5 mol. Use it to turn molality into a mole fraction: $x_2 = \dfrac{m}{m + 55.5}$ for an aqueous solution.
:::

## Henry's law

:::trap
**Larger $K_H$ means lower solubility**, not higher. In $p = K_H x$, for the same $p$, a bigger $K_H$ gives a smaller $x$. Among NCERT's values, He (144.97 kbar) is the least soluble gas listed and $\ce{CO2}$ (1.67 kbar) is far more soluble than $\ce{N2}$ or $\ce{O2}$.
:::

- $K_H$ **increases** with temperature, so gas solubility **decreases** on heating (dissolving a gas is exothermic).
- Henry's law uses the **partial** pressure of the gas, not the total pressure. For air at 10 atm, the oxygen pressure is about 2 atm.
- (Exam extra) Some books write Henry's law as "solubility = constant × pressure". Then a larger constant means **more** soluble. Check which form and which unit a question uses.

## Raoult's law and vapour pressure

:::trap
In the relative lowering of vapour pressure, the mole fraction is that of the **solute** ($x_2$). But in $p_1 = x_1 p_1^0$ it is the **solvent's** mole fraction ($x_1$). Don't swap them.
:::

- The vapour above an ideal solution is richer in the **more volatile** component (higher $p^0$). The liquid is richer in the less volatile one.
- $p_{total}$ of an ideal solution always lies **between** $p_1^0$ and $p_2^0$.

## Ideal and non-ideal solutions

:::remember
- Ideal: $\Delta_{mix}H = 0$, $\Delta_{mix}V = 0$, obeys Raoult's law at all compositions. Benzene + toluene, n-hexane + n-heptane, bromoethane + chloroethane.
- Positive deviation: ethanol + acetone, carbon disulphide + acetone.
- Negative deviation: phenol + aniline, chloroform + acetone.
:::

:::trap
**Positive deviation gives a minimum boiling azeotrope.** Higher vapour pressure means the mixture boils at a **lower** temperature. Negative deviation (lower vapour pressure) gives a **maximum boiling** azeotrope. The signs look reversed, so think through vapour pressure.
:::

- Ethanol–water: minimum boiling azeotrope, about **95% ethanol by volume**. That is why fermentation followed by fractional distillation can't give pure ethanol.
- Nitric acid–water: maximum boiling azeotrope, about **68% $\ce{HNO3}$ by mass**, b.p. **393.5 K**.
- Positive deviation: $\Delta_{mix}H > 0$ (mixing absorbs heat). Negative deviation: $\Delta_{mix}H < 0$; for example, mixing chloroform and acetone gives out heat. (NCERT Exercise 1.14 asks for this sign.)
- (Exam extra, not in NCERT) The volume usually expands on mixing for positive deviation ($\Delta_{mix}V > 0$) and shrinks for negative deviation ($\Delta_{mix}V < 0$).

## Colligative properties

:::trap
**$\Delta T_b$ and $\Delta T_f$ use molality; $\Pi$ uses molarity.** In $\Pi = CRT$ the volume is of the **solution** in litres, and $T$ is in kelvin.
:::

- They depend on the **number** of particles, not their kind. Equal molal solutions of glucose and urea give the same $\Delta T_f$.
- A $\Delta T$ is the same in K and °C. But $T$ in $\Pi = CRT$ and in the $K_b$, $K_f$ formulas must be in **K**.
- Match $R$ to the units: 0.083 L bar mol⁻¹ K⁻¹ gives $\Pi$ in bar; 0.0821 L atm mol⁻¹ K⁻¹ gives atm; 8.314 J mol⁻¹ K⁻¹ with $C$ in mol m⁻³ gives Pa.
- Use the $K_f$ the question gives. For benzene, NCERT's Table 1.3 and Example 1.10 use 5.12 K kg mol⁻¹, while Example 1.12 uses 4.9 and Exercise 1.21 uses 5.1. Both are fine within their own problems.
- NCERT's Table 1.3 lists the freezing point of water as 273.0 K, while its Example 1.9 and Exercise 1.20 use 273.15 K (0 °C). Use 273.15 K unless the question gives another value.
- The solution of a non-volatile solute **always** boils higher and freezes lower than the pure solvent.
- (Exam extra) For the same solution, $\Delta T_b / \Delta T_f = K_b / K_f$.

:::remember
**Osmotic pressure is the preferred method for proteins and polymers:** it works at room temperature, uses molarity, and gives a large, measurable value even for very dilute solutions.
:::

## Osmosis

- Solvent moves from **lower** solute concentration to **higher** solute concentration (from dilute to concentrated solution).
- Hypertonic outside (more than 0.9% NaCl): cells **shrink**. Hypotonic outside: cells **swell** (and may burst).
- Reverse osmosis needs a pressure **larger than** $\Pi$ on the solution side. Membrane: **cellulose acetate**. Use: desalination of sea water.

:::tip
"**Hyper** = more salt outside, water goes out; **hypo** = less salt outside, water goes in." Isotonic = same osmotic pressure, no net flow.
:::

## van't Hoff factor

:::trap
**Dissociation lowers the observed molar mass; association raises it.** More particles, bigger colligative effect, smaller apparent $M_2$. $i$ = normal ÷ **abnormal** molar mass, not the other way round.
:::

- For complete dissociation, $i$ = number of ions per formula unit: NaCl 2, $\ce{K2SO4}$ 3, $\ce{K3[Fe(CN)6]}$ 4. Real values are lower (Table 1.4: $\ce{MgSO4}$ is only 1.21 at 0.1 m) and approach these on dilution.
- Ethanoic acid or benzoic acid in **benzene**: dimers, $i$ close to 0.5. In **water** a weak acid dissociates slightly: $i$ a little above 1 (acetic acid in NCERT Example 1.13: $i$ = 1.041).
- To compare colligative effects of different solutions, compare $i \times m$ (or $i \times C$).

:::tip
Compare by "effective molality" $i \times m$. 0.1 m glucose (0.1) < 0.1 m NaCl (0.2) < 0.1 m $\ce{CaCl2}$ (0.3), assuming complete dissociation. The bigger $i \times m$, the larger $\Delta T_f$, $\Delta T_b$ and $\Pi$, and the **lower** the freezing point and vapour pressure.
:::

## NCERT lines to know

:::remember
- Raoult's law becomes a special case of Henry's law with $K_H = p_1^0$.
- 1 mol of sucrose in 1000 g of water boils at 373.52 K at 1 atm.
- Normal saline is 0.9% (mass/volume) NaCl.
- 35% (V/V) ethylene glycol lowers the freezing point of water to 255.4 K.
:::
