---
title: "Equilibrium: Short Notes"
type: short_notes
chapter: c11.chemistry.equilibrium
order: 2
---

## 1. Equilibrium in physical processes

- In a **closed** system a process and its reverse run at the **same rate**, so nothing measurable changes, yet both keep going: the equilibrium is **dynamic**.
- **Solid ⇌ liquid:** ice and water at 273 K and 1 atm. At 1 atm they coexist only at the normal melting point.
- **Liquid ⇌ vapour:** evaporation rate = condensation rate, so the **vapour pressure** is constant. It rises with temperature. The **normal boiling point** is measured at 1.013 bar; it is lower at high altitude.
- **Solid ⇌ vapour:** iodine, camphor, $\ce{NH4Cl}$ sublime.
- **Solid in liquid:** in a saturated sugar solution, dissolution rate = crystallisation rate (shown with radioactive sugar), so the solubility is constant at a given T.
- **Gas in liquid:** **Henry's law**: the mass of gas dissolved in a given mass of solvent is proportional to the gas pressure above it. Opening a soda bottle lowers the pressure, so $\ce{CO2}$ bubbles out. Gas solubility also falls as temperature rises.

## 2. Chemical equilibrium

- The forward rate falls and the reverse rate rises until they are equal; then the concentrations stay constant.
- Equilibrium can be reached **from either side** ($\ce{H2 + I2}$ or pure HI give the same mixture at the same temperature, if the total H and I and the volume are the same).
- **Proof that it is dynamic:** mix an equilibrium $\ce{N2/H2/NH3}$ mixture with one made using $\ce{D2}$. The amount of ammonia stays the same, but $\ce{NH2D}$, $\ce{NHD2}$ and HD appear, so the reactions are still running.

## 3. Law of chemical equilibrium (Guldberg and Waage, 1864)

- At a given temperature, products over reactants, each concentration raised to its **coefficient in the balanced equation**, is a constant, $K_c$. It is also called the **law of mass action** ("active mass" was the old word for concentration).
- The value depends on how the equation is written: reversing gives $1/K$; multiplying by $n$ gives $K^n$; halving gives $\sqrt{K}$.
- **Homogeneous equilibrium:** everything in one phase ($\ce{N2 + 3H2 <=> 2NH3}$, all gases; esterification in solution).
- **Heterogeneous equilibrium:** more than one phase. Pure solids and liquids are left out of K, because their concentration is fixed:

$$\begin{aligned} & \ce{CaCO3(s)} \\ & \ce{<=> CaO(s) + CO2(g)} \end{aligned}$$
$$K_p = p_{\ce{CO2}}$$

So at a given temperature the $\ce{CO2}$ pressure is fixed ($K_p = 2.00$ at 1100 K).

- **Units:** K has units unless the powers on top and bottom add up to the same number ($\ce{N2O4 <=> 2NO2}$: $K_c$ in mol/L, $K_p$ in bar). Dividing each term by its standard state (1 bar, 1 M) makes K dimensionless.

- **Kp and Kc:** $p = [\text{gas}]RT$ gives $K_p = K_c(RT)^{\Delta n}$ ($\Delta n$ counts gas moles only).

## 4. What K tells you

- **Extent:** large K ($> 10^3$) means mostly products; small K ($< 10^{-3}$) means mostly reactants. For example, $\ce{H2 + I2 <=> 2HI}$ has $K_c = 57.0$ at 700 K, so all three are present.
- **Direction:** $Q_c < K_c$: goes forward. $Q_c > K_c$: goes backward.
- **Equilibrium amounts:** write initial, change (in $x$, using the coefficients) and equilibrium amounts, put them in K and keep only the root that makes chemical sense (no negative amounts).
- **Gibbs energy:** $\Delta G^\ominus = -RT\ln K$, so $\Delta G^\ominus < 0$ means $K > 1$ (products favoured). K says nothing about rate.

## 5. Le Chatelier's principle

If a change is made to a system at equilibrium, the system shifts so as to **reduce** the effect of the change. It applies to all physical and chemical equilibria.

| Change | Equilibrium shifts | Does K change? |
| --- | --- | --- |
| Add a reactant / remove a product | Forward | No |
| Add a product / remove a reactant | Backward | No |
| Raise pressure (reduce volume) | To the side with fewer gas moles | No |
| Inert gas at constant volume | No shift | No |
| Raise temperature | In the endothermic direction | Yes |
| Add a catalyst | No shift (reached sooner) | No |

- **Concentration demo:** $\ce{Fe^3+ + SCN- <=> [Fe(SCN)]^2+}$ (deep red). Adding KSCN deepens the colour. Oxalic acid (removes $\ce{Fe^3+}$ as $\ce{[Fe(C2O4)3]^3-}$) or $\ce{HgCl2}$ (removes $\ce{SCN-}$ as $\ce{[Hg(SCN)4]^2-}$) fades it.
- **Industry:** removing $\ce{NH3}$ (liquefied) or $\ce{CO2}$ (from a lime kiln) keeps $Q < K$, so the reaction keeps going forward.
- **Pressure:** for $\ce{CO + 3H2 <=> CH4 + H2O}$ (4 mol gas → 2 mol), halving the volume makes $Q_c < K_c$, so it goes forward. For $\ce{C(s) + CO2 <=> 2CO}$, higher pressure pushes it backward. Solids and liquids are ignored when counting.
- **Temperature demo:** $\ce{2NO2 <=> N2O4}$ ($\Delta H = -57.2$ kJ/mol). Brown $\ce{NO2}$ fades in ice and darkens in hot water.
- **Endothermic demo:** pink $\ce{[Co(H2O)6]^2+}$ + 4 $\ce{Cl-}$ ⇌ blue $\ce{[CoCl4]^2-}$ + 6 $\ce{H2O}$. Blue at room temperature, pink when cooled.
- **Catalyst:** speeds up both directions equally; no shift. If K is extremely small, a catalyst can't help.

:::example{title="Haber process"}
$$\begin{aligned} & \ce{N2(g) + 3H2(g)} \\ & \ce{<=> 2NH3(g)} \end{aligned}$$
$\Delta H = -92.38$ kJ/mol. Low temperature favours the yield but is too slow; high pressure favours it (4 mol gas → 2 mol). Compromise: about **500 °C and 200 atm** with an **iron** catalyst.
:::

## 6. Electrolytes and ionic equilibrium

- **Strong electrolytes** (NaCl) are almost fully ionised in water. **Weak electrolytes** (acetic acid, less than 5% ionised) set up an equilibrium between ions and unionised molecules: **ionic equilibrium**.
- Water's dielectric constant (80) cuts the attraction between ions 80 times; hydration keeps them apart.
- A bare proton can't exist in water: it forms $\ce{H3O+}$ (trigonal pyramidal), which is further hydrated. $\ce{H+(aq)}$ and $\ce{H3O+}$ mean the same here.

## 7. Three ideas of acids and bases

| Theory | Acid | Base |
| --- | --- | --- |
| Arrhenius | Gives $\ce{H+}$ in water | Gives $\ce{OH-}$ in water |
| Brönsted–Lowry | Proton donor | Proton acceptor |
| Lewis | Electron-pair acceptor | Electron-pair donor |

- Arrhenius works only in water and can't explain why $\ce{NH3}$ (no OH group) is a base.
- **Conjugate pair:** an acid and the base it becomes differ by **one proton**. In $\ce{NH3 + H2O <=> NH4+ + OH-}$, $\ce{NH4+}$ is the conjugate acid of $\ce{NH3}$, and $\ce{OH-}$ is the conjugate base of $\ce{H2O}$.
- A strong acid has a very weak conjugate base, and the other way round.
- **Amphiprotic:** $\ce{H2O}$, $\ce{HCO3-}$, $\ce{HSO4-}$ and $\ce{NH3}$ can act as both acid and base.
- **Lewis acids** need not have a proton: $\ce{BF3}$, $\ce{AlCl3}$, $\ce{Co^3+}$, $\ce{Mg^2+}$. Lewis bases: $\ce{H2O}$, $\ce{NH3}$, $\ce{OH-}$, $\ce{F-}$.

## 8. Strong and weak acids and bases

- **Strong acids (NCERT list):** $\ce{HClO4}$, HCl, HBr, HI, $\ce{HNO3}$, $\ce{H2SO4}$. **Strong bases:** LiOH, NaOH, KOH, CsOH, $\ce{Ba(OH)2}$.
- An acid–base equilibrium lies on the side of the **weaker** acid and **weaker** base.
- **Indicators** (phenolphthalein, bromothymol blue) are weak acids: HIn and $\ce{In-}$ have different colours.

## 9. Water, Kw and pH

- Water ionises a tiny bit: $\ce{H2O + H2O <=> H3O+ + OH-}$. $K_w = [\ce{H+}][\ce{OH-}] = 1.0 \times 10^{-14}$ at 298 K.
- Pure water is 55.55 M, so only about 2 molecules in $10^9$ are ionised.
- Acidic: $[\ce{H+}] > [\ce{OH-}]$, pH < 7. Neutral: equal, pH = 7. Basic: pH > 7 (at 298 K).
- One pH unit is a **10-fold** change in $[\ce{H+}]$. Some NCERT values: gastric juice ~1.2, lemon juice ~2.2, black coffee 5.0, human blood 7.4, milk of magnesia 10.

## 10. Weak acids and weak bases

- $K_a = [\ce{H+}][\ce{X-}]/[\ce{HX}]$. Larger $K_a$ (smaller p$K_a$) means a stronger acid. $K_b$ works the same way for bases.
- NCERT values (298 K): $\ce{CH3COOH}$ $K_a = 1.74 \times 10^{-5}$; $\ce{NH3}$ $K_b = 1.77 \times 10^{-5}$.
- **Dilution raises α** ($\alpha = \sqrt{K_a/c}$) but lowers $[\ce{H+}]$ ($= \sqrt{K_a c}$).
- For a conjugate pair $K_a K_b = K_w$: $\ce{NH4+}$ has $K_a = 5.6 \times 10^{-10}$.
- **Polyprotic acids** (oxalic, $\ce{H2SO4}$, $\ce{H3PO4}$) ionise in steps, with $K_{a1} > K_{a2} > K_{a3}$: a proton is harder to pull off a negative ion. Nearly all the $\ce{H3O+}$ comes from the first step.

## 11. What makes an acid strong

- **Down a group, bond strength wins** (H–A weakens as A grows): HF ≪ HCl < HBr < HI; $\ce{H2S}$ is stronger than $\ce{H2O}$.
- **Across a period, electronegativity wins:** $\ce{CH4}$ < $\ce{NH3}$ < $\ce{H2O}$ < HF.

## 12. Common ion effect

Adding an ion that is already in the equilibrium pushes the equilibrium back (Le Chatelier). Acetate added to acetic acid lowers $[\ce{H+}]$ and α. For 0.05 M acetic acid + 0.05 M acetate, $[\ce{H+}] = K_a$, so pH = 4.74.

## 13. Hydrolysis of salts

| Salt from | Example | Solution |
| --- | --- | --- |
| Strong acid + strong base | NaCl, $\ce{KNO3}$ | Neutral (pH 7), no hydrolysis |
| Weak acid + strong base | $\ce{CH3COONa}$, NaCN | Basic (anion takes $\ce{H+}$ from water) |
| Strong acid + weak base | $\ce{NH4Cl}$, $\ce{NH4NO3}$ | Acidic (cation gives $\ce{H+}$) |
| Weak acid + weak base | $\ce{CH3COONH4}$ | pH = 7 + ½(p$K_a$ − p$K_b$) |

## 14. Buffer solutions

- A buffer **resists a change in pH** on adding a little acid or alkali, or on dilution.
- Acidic buffer: weak acid + its salt with a strong base ($\ce{CH3COOH}$/$\ce{CH3COONa}$, around pH 4.75). Basic buffer: weak base + its salt with a strong acid ($\ce{NH3}$/$\ce{NH4Cl}$, around pH 9.25).
- To make a buffer of a given pH, pick an acid whose p$K_a$ is close to it, then set the salt : acid ratio (Henderson–Hasselbalch).
- Moderate dilution hardly changes the pH, because the ratio stays the same.

## 15. Solubility equilibria

- By solubility: **soluble** above 0.1 M, **slightly soluble** 0.01–0.1 M, **sparingly soluble** below 0.01 M.
- A salt dissolves only if the solvation enthalpy of its ions can overcome its lattice enthalpy (so salts don't dissolve in non-polar solvents).
- $\ce{BaSO4(s) <=> Ba^2+ + SO4^2-}$: $K_{sp} = [\ce{Ba^2+}][\ce{SO4^2-}] = 1.1 \times 10^{-10}$ at 298 K, so $S = 1.05 \times 10^{-5}$ mol/L.
- **Common ion lowers solubility.** Passing HCl gas into saturated brine precipitates very pure NaCl. In gravimetric analysis, $\ce{Ag+}$ is precipitated as AgCl, $\ce{Fe^3+}$ as its hydroxide and $\ce{Ba^2+}$ as $\ce{BaSO4}$.
- **Low pH raises the solubility** of salts of weak acids (such as phosphates): $\ce{H+}$ takes up the anion, so more salt dissolves.
