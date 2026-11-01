---
title: "Chemical Kinetics: Formula Sheet"
type: formula_sheet
chapter: c12.chemistry.chemical-kinetics
order: 1
---

Notation follows NCERT: $[R]$ = molar concentration of reactant R (mol L⁻¹), $[R]_0$ = its value at $t = 0$, $k$ = rate constant. "log" is base 10 and "ln" is base $e$: $\ln x = 2.303 \log x$.

## Rate of a reaction

:::formula{title="Average rate"}
$$r_{av} = -\frac{\Delta[R]}{\Delta t}$$
$$r_{av} = +\frac{\Delta[P]}{\Delta t}$$
For $\ce{R -> P}$ at constant volume. $\Delta[R]$ is negative, so the minus sign makes the rate positive. Units: mol L⁻¹ s⁻¹ (for gases in partial pressures: atm s⁻¹).
:::

:::formula{title="Instantaneous rate"}
$$r_{inst} = -\frac{d[R]}{dt}$$
$$r_{inst} = +\frac{d[P]}{dt}$$
The average rate as $\Delta t \to 0$. On a concentration–time curve it is the slope of the tangent at time $t$ (take minus the slope for a reactant).
:::

:::formula{title="Rate with stoichiometric coefficients"}
For $\ce{aA + bB -> cC + dD}$:
$$\begin{aligned} \text{Rate} &= -\frac{1}{a}\frac{\Delta[A]}{\Delta t} \\ &= -\frac{1}{b}\frac{\Delta[B]}{\Delta t} \\ &= +\frac{1}{c}\frac{\Delta[C]}{\Delta t} \\ &= +\frac{1}{d}\frac{\Delta[D]}{\Delta t} \end{aligned}$$
Divide each rate of change by its own coefficient. Example: for $\ce{2HI -> H2 + I2}$, rate $= -\tfrac12\,\Delta[\ce{HI}]/\Delta t$.
:::

## Rate law and order

:::formula{title="Rate law (differential rate equation)"}
$$\text{Rate} = k\,[A]^x [B]^y$$
$x, y$ = order with respect to A and B. They are found **by experiment** and may differ from the coefficients $a, b$.
:::

:::formula{title="Overall order"}
$$n = x + y$$
$n$ can be 0, 1, 2, 3 or a fraction. A single exponent can even be negative (NCERT: Rate $= k[A]^{3/2}[B]^{-1}$ has order $\tfrac12$).
:::

:::formula{title="Units of the rate constant"}
$$\text{units of } k = (\text{mol L}^{-1})^{1-n}\,\text{s}^{-1}$$
$n$ = overall order. With pressure in atm: $\text{atm}^{1-n}\,\text{s}^{-1}$.
:::

| Order | Units of $k$ |
| --- | --- |
| 0 | mol L⁻¹ s⁻¹ |
| 1 | s⁻¹ |
| 2 | mol⁻¹ L s⁻¹ |
| 3 | mol⁻² L² s⁻¹ |

The units of **rate** are always concentration per time (mol L⁻¹ s⁻¹), whatever the order. Only the units of $k$ change with order.

## Zero order reactions

:::formula{title="Integrated rate law (zero order)"}
$$[R] = [R]_0 - kt$$
$$k = \frac{[R]_0 - [R]}{t}$$
Rate $= k$, independent of concentration. Plot of $[R]$ vs $t$: straight line, slope $= -k$, intercept $= [R]_0$.

Valid only while reactant is left: up to $t = [R]_0/k$, when $[R]$ reaches zero.
:::

:::formula{title="Half-life (zero order)"}
$$t_{1/2} = \frac{[R]_0}{2k}$$
Directly proportional to $[R]_0$: double the starting concentration and the half-life doubles.
:::

## First order reactions

:::formula{title="Integrated rate law (first order)"}
$$\ln[R] = \ln[R]_0 - kt$$
$$[R] = [R]_0\, e^{-kt}$$
$$k = \frac{2.303}{t}\log\frac{[R]_0}{[R]}$$
Plot of $\ln[R]$ vs $t$: straight line, slope $= -k$, intercept $= \ln[R]_0$. Plot of $\log([R]_0/[R])$ vs $t$: straight line through the origin, slope $= k/2.303$.
:::

:::formula{title="Between two times"}
$$k = \frac{2.303}{t_2 - t_1}\log\frac{[R]_1}{[R]_2}$$
$[R]_1$, $[R]_2$ = concentrations at $t_1$ and $t_2$. Amounts (g or mol) can replace concentrations, since only their ratio is used.
:::

:::formula{title="Half-life (first order)"}
$$t_{1/2} = \frac{0.693}{k}$$
Independent of $[R]_0$. ($0.693 = \ln 2 = 2.303 \times 0.301$.)
:::

:::formula{title="After n half-lives (first order only)"}
$$[R] = \frac{[R]_0}{2^n}$$
$n = t/t_{1/2}$. Uses the fact that $t_{1/2}$ stays constant, which is true only for first order.
:::

:::formula{title="Time for x% completion (first order)"}
$$t = \frac{2.303}{k}\log\frac{100}{100 - x}$$
- 75%: $t = 2\,t_{1/2}$
- 99%: $t = 2 \times t_{90\%}$ (NCERT Exercise 3.18)
- 99.9%: $t = 6.909/k \approx 10\,t_{1/2}$ (NCERT Example 3.8)
:::

:::formula{title="Gas phase first order: A(g) → B(g) + C(g)"}
$$p_A = 2p_i - p_t$$
$$k = \frac{2.303}{t}\log\frac{p_i}{2p_i - p_t}$$
$p_i$ = initial pressure of A, $p_t$ = total pressure at time $t$, constant volume and temperature. For other equations, redo the pressure table from the stoichiometry (e.g. for $\ce{2N2O5 -> 2N2O4 + O2}$: $p_{\ce{N2O5}} = 3p_i - 2p_t$).
:::

## Temperature and activation energy

:::formula{title="Arrhenius equation"}
$$k = A\,e^{-E_a/RT}$$
$A$ = Arrhenius (frequency, pre-exponential) factor, same units as $k$; $E_a$ = activation energy (J mol⁻¹); $R$ = 8.314 J K⁻¹ mol⁻¹; $T$ in kelvin.

$e^{-E_a/RT}$ = fraction of molecules with energy equal to or greater than $E_a$.
:::

:::formula{title="Logarithmic form"}
$$\ln k = \ln A - \frac{E_a}{RT}$$
$$\log k = \log A - \frac{E_a}{2.303RT}$$
Plot of $\ln k$ vs $1/T$: straight line, slope $= -E_a/R$, intercept $= \ln A$. (For $\log k$ vs $1/T$ the slope is $-E_a/2.303R$.)
:::

:::formula{title="Two temperatures"}
$$\begin{aligned} \log\frac{k_2}{k_1} = {} & \frac{E_a}{2.303R} \\ & \times \frac{T_2 - T_1}{T_1 T_2} \end{aligned}$$
$$\begin{aligned} \ln\frac{k_2}{k_1} = {} & \frac{E_a}{R} \\ & \times \left(\frac{1}{T_1} - \frac{1}{T_2}\right) \end{aligned}$$
Assumes $E_a$ and $A$ do not change between $T_1$ and $T_2$. Use $E_a$ in J mol⁻¹ with $R$ = 8.314; $2.303R$ = 19.15 J K⁻¹ mol⁻¹.
:::

:::formula{title="Rule of thumb"}
A 10° rise in temperature nearly **doubles** the rate constant (NCERT). The ratio $k_{T+10}/k_T$ is often called the temperature coefficient, usually 2 to 3 (beyond the syllabus: the name is not in NCERT or either syllabus).
:::

:::formula{title="Activation energies from the energy profile"}
$$\Delta_r H = E_{a,f} - E_{a,b}$$
$E_{a,f}$, $E_{a,b}$ = activation energies of the forward and backward reactions. Beyond the syllabus: the relation is not written in NCERT or either syllabus, but it can be read straight off the potential energy diagram (NCERT Fig. 3.7).
:::

:::formula{title="Effect of a catalyst"}
$$\frac{k_{cat}}{k} = e^{(E_a - E_{a,cat})/RT}$$
Not a separate NCERT formula: it is the Arrhenius equation written for both paths. Assumes $A$ and $T$ are the same with and without the catalyst.
:::

## Collision theory

:::formula{title="Rate from collision theory"}
$$\text{Rate} = Z_{AB}\, e^{-E_a/RT}$$
$$\text{Rate} = P\,Z_{AB}\, e^{-E_a/RT}$$
For a bimolecular elementary reaction $\ce{A + B -> Products}$. $Z_{AB}$ = collision frequency (collisions per second per unit volume), $P$ = probability (steric) factor for proper orientation. Comparing with Arrhenius: $A$ is related to $Z_{AB}$. (NCERT's summary writes the second form for $k$.)
:::

:::formula{title="Threshold energy (NCERT footnote)"}
$$\begin{aligned} & \text{Threshold energy} \\ & = E_a + \text{energy of reactants} \end{aligned}$$
The minimum energy that colliding molecules must have for an effective collision.
:::

## Numbers worth knowing

| Quantity | Value |
| --- | --- |
| $\ln 2$ | 0.693 |
| $\log 2$, $\log 3$ | 0.301, 0.477 |
| $R$ | 8.314 J K⁻¹ mol⁻¹ |
| $2.303R$ | 19.15 J K⁻¹ mol⁻¹ |
| $t_{1/2}$ of $\ce{N2O5}$ | 12 min at 50 °C, 5 h at 25 °C, 10 days at 0 °C |
