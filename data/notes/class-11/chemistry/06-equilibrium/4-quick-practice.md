---
title: "Equilibrium: Quick Practice"
type: practice
chapter: c11.chemistry.equilibrium
order: 4
---

Try each question first, then tap **Show answer**. All questions are at 298 K ($K_w = 10^{-14}$) unless they say otherwise.

## Chemical equilibrium

:::question{title="1. Kp and Kc" exam="NEET level"}
For $\ce{N2(g) + 3H2(g) <=> 2NH3(g)}$, what is $K_p / K_c$?

---

$\Delta n = 2 - (1 + 3) = -2$, so $K_p = K_c(RT)^{-2}$ and $K_p/K_c =$ **$(RT)^{-2}$**.
:::

:::question{title="2. Which way?" exam="JEE Main level"}
For $\ce{H2(g) + I2(g) <=> 2HI(g)}$, $K_c = 57.0$ at 700 K. A mixture at 700 K has $[\ce{HI}] = 0.50$ M and $[\ce{H2}] = [\ce{I2}] = 0.050$ M. In which direction will the net reaction go?

---

$Q_c = \dfrac{(0.50)^2}{(0.050)(0.050)} = \dfrac{0.25}{0.0025} = 100$.

$Q_c > K_c$, so the net reaction goes **backward**: HI decomposes until $Q_c$ falls to 57.0.
:::

:::question{title="3. More PCl3" exam="NEET level"}
For $\ce{PCl5(g) <=> PCl3(g) + Cl2(g)}$, $\Delta_r H^\ominus = +124$ kJ/mol. Which change gives more $\ce{PCl3}$ at the new equilibrium: (a) adding helium at constant volume, (b) compressing the mixture, (c) raising the temperature, (d) adding a catalyst?

---

(a) changes no partial pressure: no shift. (b) favours fewer gas moles: backward. (d) changes only the rate. The forward reaction is endothermic, so raising T raises K and shifts it forward: **(c)**.
:::

:::question{title="4. Dissociation of N2O4" exam="JEE Main level"}
$\ce{N2O4(g) <=> 2NO2(g)}$ is 20% dissociated at a total pressure of 1.2 bar. Find $K_p$.

---

Start with 1 mol $\ce{N2O4}$. At equilibrium: $\ce{N2O4}$ $1 - \alpha$, $\ce{NO2}$ $2\alpha$, total $1 + \alpha$.

$$K_p = \frac{4\alpha^2 P}{1 - \alpha^2}$$

$K_p = \dfrac{4(0.2)^2(1.2)}{1 - 0.04} = \dfrac{0.192}{0.96} =$ **0.20 bar**.
:::

:::question{title="5. ΔG° from K" exam="NEET level"}
A reaction has $K = 10$ at 300 K. Find $\Delta G^\ominus$. ($R = 8.314$ J mol⁻¹ K⁻¹)

---

$\Delta G^\ominus = -2.303\,RT\log K = -2.303 \times 8.314 \times 300 \times 1 = -5744$ J/mol, about **−5.74 kJ/mol**.
:::

## Ionic equilibrium

:::question{title="6. pH of a weak acid" exam="NEET level"}
Find the pH of 0.10 M acetic acid. $K_a = 1.8 \times 10^{-5}$. (log 1.34 = 0.13)

---

$[\ce{H+}] = \sqrt{K_a c} = \sqrt{1.8 \times 10^{-6}} = 1.34 \times 10^{-3}$ M. Then $\alpha = 1.34\%$, small enough for the shortcut.

pH $= 3 - 0.13 =$ **2.87**.
:::

:::question{title="7. Mixing acid and base" exam="NEET level"}
20 mL of 0.10 M HCl is mixed with 30 mL of 0.10 M NaOH. Find the pH. (log 2 = 0.30)

---

$\ce{H+}$: 2.0 mmol. $\ce{OH-}$: 3.0 mmol. Left over: 1.0 mmol $\ce{OH-}$ in 50 mL, so $[\ce{OH-}] = 0.020$ M.

pOH $= 2 - 0.30 = 1.70$, so pH $=$ **12.30**.
:::

:::question{title="8. Half-made buffer" exam="JEE Main level"}
50 mL of 0.20 M $\ce{CH3COOH}$ is mixed with 20 mL of 0.20 M NaOH. Find the pH. (p$K_a$ = 4.74, log 1.5 = 0.18)

---

Acid: 10 mmol. NaOH: 4 mmol, which turns 4 mmol of acid into acetate. Left: 6 mmol acid and 4 mmol acetate, in the same volume. This is a buffer:

pH $= 4.74 + \log\dfrac{4}{6} = 4.74 - 0.18 =$ **4.56**.
:::

:::question{title="9. pH of a salt solution" exam="JEE Main level"}
Find the pH of 0.10 M sodium acetate. p$K_a$ of acetic acid = 4.74.

---

Acetate is hydrolysed: $\ce{CH3COO- + H2O <=> CH3COOH + OH-}$, with $K_h = K_w/K_a$.

$[\ce{OH-}] = \sqrt{K_h c}$, so pOH $= \tfrac12(14 - 4.74 - \log 0.10) = \tfrac12(10.26) = 5.13$.

pH $= 14 - 5.13 =$ **8.87**. (Same as $7 + \tfrac12(\text{p}K_a + \log c) = 7 + \tfrac12(3.74)$.)
:::

:::question{title="10. Common ion" exam="NEET level"}
$K_{sp}$ of $\ce{Mg(OH)2}$ is $1.8 \times 10^{-11}$. Find its molar solubility in 0.10 M NaOH.

---

$K_{sp} = [\ce{Mg^2+}][\ce{OH-}]^2 = S\,(0.10 + 2S)^2 \approx S\,(0.10)^2$, since $2S \ll 0.10$.

$S = \dfrac{1.8 \times 10^{-11}}{0.010} =$ **$1.8 \times 10^{-9}$ M**. In pure water it would be $1.65 \times 10^{-4}$ M (from $4S^3$), so the common ion lowers it about 90,000 times.
:::
