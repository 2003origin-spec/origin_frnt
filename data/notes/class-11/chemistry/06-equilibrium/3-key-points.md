---
title: "Equilibrium: Important Points and Traps"
type: key_points
chapter: c11.chemistry.equilibrium
order: 3
---

## The equilibrium constant

:::trap
**Only temperature changes K.** Changing concentration, pressure or volume, adding an inert gas or adding a catalyst can shift the equilibrium (or do nothing), but K stays the same. K also does not depend on the starting amounts.
:::

- K belongs to the equation **as written**. If $\ce{H2 + I2 <=> 2HI}$ has $K$, then $\ce{2HI <=> H2 + I2}$ has $1/K$ and $\ce{1/2H2 + 1/2I2 <=> HI}$ has $\sqrt{K}$.
- Pure solids and liquids never appear in K, but they must be **present**: $\ce{CaCO3 <=> CaO + CO2}$ needs some of both solids for $p_{\ce{CO2}}$ to be fixed.
- Adding more of a pure solid (more $\ce{CaCO3}$, more graphite) does **not** shift the equilibrium.

:::trap
**$\Delta n$ counts gas moles only.** For $\ce{C(s) + CO2(g) <=> 2CO(g)}$, $\Delta n = 2 - 1 = +1$ (carbon is not counted). For $\ce{2NOCl(g) <=> 2NO(g) + Cl2(g)}$, $\Delta n = 3 - 2 = +1$. $K_p = K_c$ only when $\Delta n = 0$.
:::

- In $K_p = K_c(RT)^{\Delta n}$ use $R = 0.0831$ bar L mol⁻¹ K⁻¹, not 8.314, because $K_p$ uses bar and $K_c$ uses mol/L.
- A large K tells you **how far**, not **how fast**. $\ce{2SO2 + O2 <=> 2SO3}$ has $K_c = 1.7 \times 10^{26}$ but is very slow, so Pt or $\ce{V2O5}$ is used as a catalyst.

:::tip
**Q tells you which way.** $Q < K$: too little product, so the reaction goes **forward**. $Q > K$: too much product, so it goes **backward**.
:::

## Le Chatelier's principle

:::trap
**Inert gas:** at **constant volume** it changes no partial pressure, so there is **no shift** (NCERT). At **constant pressure** (exam extra, not in NCERT) the volume grows, which acts like lowering the pressure: the equilibrium shifts towards **more** gas moles (no shift if $\Delta n = 0$).
:::

- Pressure has no effect when gas moles are equal on both sides ($\ce{H2 + I2 <=> 2HI}$).
- After adding a reactant, its new equilibrium concentration is **lower** than just after adding it but **higher** than before.
- **Exothermic** reaction: raising T lowers K and lowers the yield ($\ce{NH3}$ synthesis, $\ce{2NO2 <=> N2O4}$). **Endothermic**: raising T raises K ($\ce{PCl5 <=> PCl3 + Cl2}$, $\Delta_r H^\ominus = +124$ kJ/mol).
- A catalyst lowers the activation energy of the forward and reverse reactions **by the same amount**. Equilibrium is reached sooner; its composition doesn't change.

:::trap
**Cobalt demo: the pink ion is $\ce{[Co(H2O)6]^2+}$.** The NCERT reprint shows it as $\ce{[Co(H2O)6]^3+}$, which seems to be a small misprint. Cobalt is +2 in both ions, and only $\ce{[Co(H2O)6]^2+}$ balances the charge: $(+2) + 4(-1) = -2$, the charge of $\ce{[CoCl4]^2-}$. The forward reaction (pink to blue) is endothermic, so cooling turns it pink.
:::

## Acids and bases

- **Conjugate pairs differ by one proton.** Conjugate base of $\ce{H2SO4}$ is $\ce{HSO4-}$ (not $\ce{SO4^2-}$); of $\ce{HCO3-}$ is $\ce{CO3^2-}$. Conjugate acid of $\ce{NH2-}$ is $\ce{NH3}$; of $\ce{HCOO-}$ is HCOOH.
- A Lewis acid need not contain hydrogen: $\ce{BF3}$, $\ce{AlCl3}$, $\ce{Mg^2+}$. $\ce{H+}$ itself is a Lewis acid. A Brönsted base must have a lone pair to take a proton, so it is also a Lewis base.
- **Down a group:** HF is the **weakest** hydrogen halide acid, though F is the most electronegative. Bond strength decides: HF ≪ HCl < HBr < HI.
- **Across a period:** electronegativity decides: $\ce{CH4}$ < $\ce{NH3}$ < $\ce{H2O}$ < HF.

:::trap
**Very dilute strong acid.** $10^{-8}$ M HCl does **not** have pH 8; an acid can't be basic. Add water's own ions: with $x = [\ce{OH-}]$, $[\ce{H+}] = 10^{-8} + x$. Solving $x(10^{-8} + x) = 10^{-14}$ gives pOH = 7.02, so pH = **6.98** (NCERT).
:::

:::trap
**Neutral is not always pH 7.** $K_w$ grows with temperature (water's ionisation is endothermic). At 310 K, $K_w = 2.7 \times 10^{-14}$, so neutral water has pH ≈ 6.78. It is still neutral because $[\ce{H+}] = [\ce{OH-}]$.
:::

- Dilution **increases** the degree of ionisation α of a weak acid, but its $[\ce{H+}]$ still **falls**.
- A common ion **decreases** α (acetate in acetic acid; HCl in $\ce{H2S}$).
- For a polyprotic acid, take $[\ce{H+}]$ from the first step only: $K_{a2}$ and $K_{a3}$ are much smaller.

## Salts and buffers

:::remember
**Which salt gives which solution:**
- NaCl, KBr, $\ce{KNO3}$: neutral.
- NaCN, KF, $\ce{NaNO2}$, $\ce{CH3COONa}$: **basic** (anion of a weak acid).
- $\ce{NH4Cl}$, $\ce{NH4NO3}$: **acidic** (cation of a weak base).
- $\ce{CH3COONH4}$: nearly neutral (p$K_a$ ≈ p$K_b$), but it **is** hydrolysed.
:::

- For a weak acid + weak base salt, the degree of hydrolysis and the pH do **not** depend on concentration.
- Buffer pH hardly changes on moderate dilution (the ratio is the same); very large dilution does change it. A buffer works best when [salt] ≈ [acid], that is pH ≈ p$K_a$.

:::trap
**Basic buffer: check the ratio.** The correct form is
$$\text{pH} = \text{p}K_a(\ce{BH+}) + \log\frac{[\text{B}]}{[\ce{BH+}]}$$
In the 2025-26 NCERT reprint, eq. 6.42 seems to have a small misprint: the ratio appears upside down. It follows from eq. 6.41: $\text{pH} = 14 - \text{pOH}$ flips the log term. Check: more base must give a **higher** pH. NCERT Problem 6.22 (0.1 M $\ce{NH3}$, 0.2 M $\ce{NH4Cl}$) gets pH 8.95, which matches the form above.
:::

:::tip
To get the pH of a **partly neutralised** weak acid, first do the stoichiometry (the strong base turns HA into $\ce{A-}$), then use Henderson–Hasselbalch on what is left. At half-neutralisation, pH = p$K_a$.
:::

## Solubility product

:::trap
**Compare solubilities, not Ksp values**, when the salts have different formula types. AgCl ($K_{sp} = 1.8 \times 10^{-10}$) has $S = 1.3 \times 10^{-5}$ M. $\ce{Ag2CrO4}$ has a smaller $K_{sp}$ ($1.1 \times 10^{-12}$) but, from $4S^3$, a **larger** $S = 6.5 \times 10^{-5}$ M.
:::

- When two solutions are mixed, **halve** each concentration (equal volumes) before working out $Q_{sp}$.
- A common ion lowers solubility a lot: $\ce{Ni(OH)2}$ ($K_{sp} = 2.0 \times 10^{-15}$) dissolves only $2.0 \times 10^{-13}$ M in 0.10 M NaOH.
- Salts of weak acids (phosphates) dissolve **more** at low pH.

:::tip
**Ksp multipliers:** AB → $S^2$, AB₂ → $4S^3$, AB₃ → $27S^4$, A₂B₃ → $108S^5$. In general $x^x y^y S^{x+y}$.
:::

## NCERT lines to know

:::remember
- At equilibrium the rates of the forward and reverse reactions are **equal**; the equilibrium is dynamic.
- $K_w = 1.0 \times 10^{-14}$ at 298 K; pure water is 55.55 M.
- Haber process: about 500 °C, 200 atm, iron catalyst; $\Delta H = -92.38$ kJ/mol.
- Acetic acid is less than 5% ionised; HCl is completely ionised.
- p$K_a$ of $\ce{NH4+}$ is 9.25; an equimolar $\ce{NH3}$/$\ce{NH4Cl}$ buffer has pH about 9.25.
:::
