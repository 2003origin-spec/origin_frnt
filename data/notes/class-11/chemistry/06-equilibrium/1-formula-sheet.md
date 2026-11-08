---
title: "Equilibrium: Formula Sheet"
type: formula_sheet
chapter: c11.chemistry.equilibrium
order: 1
---

## Equilibrium constant

:::formula{title="Law of chemical equilibrium (Kc)"}
For $\ce{aA + bB <=> cC + dD}$:
$$K_c = \frac{[C]^c\,[D]^d}{[A]^a\,[B]^b}$$
$[\;]$ = **equilibrium** molar concentration (mol/L). The powers are the coefficients of the balanced equation.

Leave out pure solids and pure liquids: their concentration is constant. They must still be present for the equilibrium to exist.
:::

:::formula{title="Kp for gas reactions"}
$$K_p = \frac{p_C^{\,c}\;p_D^{\,d}}{p_A^{\,a}\;p_B^{\,b}}$$
$p$ = equilibrium partial pressure, in **bar** (the standard state is 1 bar). Only gases appear.
:::

:::formula{title="Relation between Kp and Kc"}
$$K_p = K_c\,(RT)^{\Delta n}$$
$\Delta n$ = (moles of **gaseous** products) − (moles of **gaseous** reactants) in the balanced equation.
$R = 0.0831$ bar L mol⁻¹ K⁻¹ (this value matches $p$ in bar and $[\;]$ in mol/L), $T$ in kelvin.

$\Delta n = 0$ gives $K_p = K_c$ (for example $\ce{H2 + I2 <=> 2HI}$).
:::

:::formula{title="Changing the equation changes K"}
Reverse the equation:
$$K' = \frac{1}{K}$$
Multiply the whole equation by $n$:
$$K' = K^{\,n}$$
Add two equations:
$$K_\text{net} = K_1 \times K_2$$
So always quote K together with the equation it belongs to.
:::

## Using K

:::formula{title="Reaction quotient Q"}
$Q_c$ has the same form as $K_c$, but uses the concentrations at **any** moment, not only at equilibrium.
- $Q_c < K_c$: net reaction goes **forward** (left to right).
- $Q_c > K_c$: net reaction goes **backward** (right to left).
- $Q_c = K_c$: already at equilibrium.
:::

:::formula{title="Size of K and extent of reaction"}
- $K_c > 10^3$: products dominate; the reaction goes nearly to completion.
- $K_c < 10^{-3}$: reactants dominate; very little product.
- $10^{-3}$ to $10^3$: both present in appreciable amounts.

K says nothing about **how fast** equilibrium is reached.
:::

:::formula{title="K and Gibbs energy"}
$$\Delta G = \Delta G^\ominus + RT\ln Q$$
At equilibrium $\Delta G = 0$ and $Q = K$, so:
$$\Delta G^\ominus = -RT\ln K$$
$$\Delta G^\ominus = -2.303\,RT\log K$$
$R = 8.314$ J mol⁻¹ K⁻¹. $\Delta G^\ominus < 0$ gives $K > 1$; $\Delta G^\ominus > 0$ gives $K < 1$.
:::

:::formula{title="K and temperature: van 't Hoff (exam extra, not in NCERT)"}
$$\begin{aligned} \log\frac{K_2}{K_1} &= \frac{\Delta H^\ominus}{2.303\,R} \\ &\quad \times \left(\frac{1}{T_1} - \frac{1}{T_2}\right) \end{aligned}$$
Assumes $\Delta H^\ominus$ stays constant between $T_1$ and $T_2$. Endothermic: K rises with T. Exothermic: K falls with T.
:::

:::formula{title="Degree of dissociation from vapour density (exam extra)"}
$$\alpha = \frac{D - d}{(n - 1)\,d}$$
$D$ = vapour density with no dissociation, $d$ = vapour density of the equilibrium mixture, $n$ = moles of gas formed from 1 mole of the reactant ($n > 1$).
:::

## Water and pH

:::formula{title="Ionic product of water"}
$$K_w = [\ce{H3O+}][\ce{OH-}]$$
$K_w = 1.0 \times 10^{-14}$ at 298 K. It is an equilibrium constant, so it changes with temperature.
:::

:::formula{title="pH, pOH and pK"}
$$\text{pH} = -\log[\ce{H+}]$$
$$\text{pH} + \text{pOH} = \text{p}K_w$$
$\text{p}K_w = 14$ at 298 K only. $\text{p}X = -\log X$, so $\text{p}K_a = -\log K_a$. Strictly pH $= -\log a_{\ce{H+}}$ (activity); it equals $-\log[\ce{H+}]$ in dilute solutions.
:::

## Weak acids and bases

:::formula{title="Weak acid HX (concentration c, degree of ionisation α)"}
$$K_a = \frac{c\alpha^2}{1 - \alpha}$$
If $\alpha$ is small (a few per cent), $1 - \alpha \approx 1$:
$$\alpha = \sqrt{K_a / c}$$
Since $[\ce{H+}] = c\alpha$:
$$[\ce{H+}] = \sqrt{K_a\,c}$$
$$\text{pH} = \tfrac12(\text{p}K_a - \log c)$$
Many books call this Ostwald's dilution law; NCERT derives it without the name. If $\alpha$ is not small, solve the quadratic.
:::

:::formula{title="Weak base B"}
$$K_b = \frac{c\alpha^2}{1 - \alpha}$$
$$[\ce{OH-}] = \sqrt{K_b\,c}$$
$$\text{pOH} = \tfrac12(\text{p}K_b - \log c)$$
Same condition: $\alpha$ small.
:::

:::formula{title="Conjugate acid–base pair"}
$$K_a \times K_b = K_w$$
$$\text{p}K_a + \text{p}K_b = 14$$
$K_a$ belongs to the acid, $K_b$ to **its own** conjugate base (e.g. $\ce{NH4+}$ and $\ce{NH3}$). 14 holds at 298 K.
:::

## Salt hydrolysis (at 298 K)

:::formula{title="Weak acid + weak base salt (NCERT)"}
$$\text{pH} = 7 + \tfrac12(\text{p}K_a - \text{p}K_b)$$
Example: $\ce{CH3COONH4}$. The pH does not depend on the concentration.
:::

:::formula{title="Other salts (exam extra; needed for NCERT exercise 6.61)"}
Weak acid + strong base ($\ce{CH3COONa}$), $c$ = salt concentration:
$$\text{pH} = 7 + \tfrac12(\text{p}K_a + \log c)$$
Strong acid + weak base ($\ce{NH4Cl}$):
$$\text{pH} = 7 - \tfrac12(\text{p}K_b + \log c)$$
Hydrolysis constant and degree of hydrolysis $h$ (small $h$):
$$K_h = K_w / K_a$$
$$h = \sqrt{K_h / c}$$
For $\ce{NH4Cl}$ use $K_h = K_w / K_b$.
:::

## Buffers

:::formula{title="Acidic buffer: Henderson–Hasselbalch equation"}
$$\text{pH} = \text{p}K_a + \log\frac{[\text{Salt}]}{[\text{Acid}]}$$
Weak acid + its salt with a strong base (e.g. $\ce{CH3COOH + CH3COONa}$). Equal concentrations give pH = p$K_a$.
:::

:::formula{title="Basic buffer"}
$$\text{pOH} = \text{p}K_b + \log\frac{[\ce{BH+}]}{[\text{B}]}$$
In terms of pH (p$K_a$ of $\ce{BH+}$):
$$\text{pH} = \text{p}K_a + \log\frac{[\text{B}]}{[\ce{BH+}]}$$
Example: $\ce{NH3 + NH4Cl}$, p$K_a(\ce{NH4+}) = 9.25$.
:::

## Solubility product

:::formula{title="Ksp and molar solubility S"}
For $\ce{M_xX_y(s) <=> xM^{p+} + yX^{q-}}$:
$$K_{sp} = [\ce{M^{p+}}]^x\,[\ce{X^{q-}}]^y$$
$$K_{sp} = x^x\,y^y\,S^{\,x+y}$$
$S$ = molar solubility (mol/L), in pure water, if neither ion reacts with water.
:::

| Salt type | Example | $K_{sp}$ |
| --- | --- | --- |
| AB | $\ce{BaSO4}$, $\ce{AgCl}$ | $S^2$ |
| AB₂ or A₂B | $\ce{Ni(OH)2}$, $\ce{Ag2CrO4}$ | $4S^3$ |
| AB₃ | $\ce{Fe(OH)3}$ | $27S^4$ |
| A₂B₃ | $\ce{A2X3}$ | $108S^5$ |
| A₃B₄ | $\ce{Zr3(PO4)4}$ | $6912S^7$ |

:::formula{title="Will it precipitate?"}
Ionic product $Q_{sp}$ is written like $K_{sp}$ but with the concentrations **actually present** (after mixing, so allow for dilution).
- $Q_{sp} > K_{sp}$: precipitate forms.
- $Q_{sp} = K_{sp}$: saturated.
- $Q_{sp} < K_{sp}$: no precipitate; more can dissolve.
:::

:::formula{title="Common ion effect on solubility"}
$\ce{Ni(OH)2}$ in NaOH of concentration $c$ (when $2S \ll c$):
$$S = \frac{K_{sp}}{c^2}$$
For an AB salt in $c$ M of a common ion: $S = K_{sp}/c$.
:::

:::formula{title="Salt of a weak acid at low pH (NCERT)"}
For a 1:1 salt MX, where HX is a weak acid:
$$S = \sqrt{\frac{K_{sp}\,([\ce{H+}] + K_a)}{K_a}}$$
Lower pH (more $\ce{H+}$) means higher solubility.
:::
