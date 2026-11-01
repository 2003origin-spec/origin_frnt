---
title: "Chemical Kinetics: Important Points and Traps"
type: key_points
chapter: c12.chemistry.chemical-kinetics
order: 3
---

## Rate and rate constant

:::trap
**Rate is not the rate constant.** The rate falls as reactants are used up. $k$ stays the same during the reaction; it changes only with temperature (or a catalyst). For a **zero order** reaction alone, rate $= k$ at every moment.
:::

- Units of **rate** are always concentration per time (mol L⁻¹ s⁻¹), whatever the order. Units of **$k$** depend on the order: $(\text{mol L}^{-1})^{1-n}\,\text{s}^{-1}$. So the units of $k$ tell you the order: s⁻¹ means first order, L mol⁻¹ s⁻¹ means second order.

:::trap
Divide by the coefficient. For $\ce{2A -> products}$, rate of reaction $= -\tfrac12\,d[A]/dt$, which is **half** the rate at which A disappears. In $\ce{N2 + 3H2 -> 2NH3}$, $\ce{H2}$ is used 3 times as fast as $\ce{N2}$, and $\ce{NH3}$ forms twice as fast as $\ce{N2}$ is used.
:::

## Order and molecularity

:::trap
**Never read the rate law from the balanced equation** (unless you are told the reaction is elementary). $\ce{KClO3 + 6FeSO4 + 3H2SO4}$ looks tenth order but is second order. $\ce{CHCl3 + Cl2}$ has order $\tfrac32$.
:::

- Order can be 0, a whole number or a fraction, and an order with respect to one species can be **negative** (Rate $= k[A]^{3/2}[B]^{-1}$ is overall half order).
- Molecularity is only 1, 2 or 3; never 0, never a fraction. It has **no meaning** for a complex reaction as a whole; it applies to each elementary step.
- For a complex reaction, the order is given by the **slowest step**, and equals the molecularity of that step (NCERT's rule; it works directly when the slow step involves only the starting reactants, as in the $\ce{H2O2}$/$\ce{I-}$ example).
- An intermediate (like $\ce{IO-}$ in the $\ce{H2O2}$/$\ce{I-}$ reaction) does not appear in the overall equation.

:::remember
- Order is an **experimental** quantity.
- Molecularity is a **theoretical** one, defined only for elementary reactions.
- For an elementary reaction, order = molecularity.
:::

## Zero and first order

:::trap
**$t_{1/2} = 0.693/k$ is for first order only.** For zero order $t_{1/2} = [R]_0/2k$, which depends on the starting concentration. The rule "after $n$ half-lives, $[R]_0/2^n$ is left" also needs first order, because only then is every half-life the same length.
:::

- A zero order reaction **stops** when the reactant runs out, at $t = [R]_0/k$ (which is $2t_{1/2}$). Don't use $[R] = [R]_0 - kt$ beyond that, or you get a negative concentration.
- A first order reaction never quite reaches zero; in theory it takes infinite time to finish.
- First order: equal times remove equal **fractions**. Zero order: equal times remove equal **amounts**.

:::tip
First-order shortcuts:
- 50% done: $t_{1/2}$
- 75% done: $2t_{1/2}$
- 87.5% done: $3t_{1/2}$
- 99% done: twice the time for 90%
- 99.9% done: about $10\,t_{1/2}$
:::

:::trap
**75% time vs 50% time.** First order: $t_{75\%} = 2\,t_{1/2}$. Zero order: $t_{75\%} = 1.5\,t_{1/2}$ (since $t = x[R]_0/k$ is proportional to the fraction $x$ used up).
:::

- With amounts instead of concentrations (grams, moles, pressures of the reactant alone), the first-order equation still works, because only the **ratio** $[R]_0/[R]$ is used.

:::trap
**Total pressure is not the reactant's pressure.** For $\ce{A(g) -> B(g) + C(g)}$, use $p_A = 2p_i - p_t$, not $p_t$. Make a fresh pressure table for every new equation.
:::

- (Beyond the syllabus) For a reaction of order $n$ with one reactant, $t_{1/2} \propto [R]_0^{\,1-n}$. Zero order: proportional to $[R]_0$; first order: independent; second order: inversely proportional. The second order integrated equation is **not** in current NCERT or either syllabus.

:::remember
- Zero order examples (NCERT): $\ce{NH3}$ on hot Pt at **high pressure**; HI on a **gold** surface; some enzyme-catalysed reactions.
- First order examples: hydrogenation of ethene; decomposition of $\ce{N2O5}$ and $\ce{N2O}$; **all** radioactive decay.
- Pseudo first order: acid hydrolysis of ethyl acetate; inversion of cane sugar.
:::

## Graphs to recognise

| Order | Plot | Line |
| --- | --- | --- |
| 0 | $[R]$ vs $t$ | Slope $-k$, intercept $[R]_0$ |
| 1 | $\ln[R]$ vs $t$ | Slope $-k$, intercept $\ln[R]_0$ |
| 1 | $\log([R]_0/[R])$ vs $t$ | Through origin, slope $k/2.303$ |
| Arrhenius | $\ln k$ vs $1/T$ | Slope $-E_a/R$, intercept $\ln A$ |

:::trap
**Slope sign and log base.** The Arrhenius slope is $-E_a/R$ for $\ln k$ but $-E_a/2.303R$ for $\log k$. A steeper slope means a **larger** $E_a$, so $k$ is more sensitive to temperature.
:::

## Temperature and activation energy

:::trap
**Units.** Use $T$ in kelvin, and $E_a$ in J mol⁻¹ with $R$ = 8.314 J K⁻¹ mol⁻¹. Forgetting to change kJ to J gives an answer 1000 times off.
:::

- Heating speeds a reaction mainly because a **larger fraction** of molecules has energy $\ge E_a$, not just because they collide more often. A 10° rise roughly doubles that fraction (the shaded area in NCERT Fig. 3.9).
- On heating, the Maxwell–Boltzmann peak moves to **higher** energy and gets **lower and broader**; the area under the curve does not change.
- Lower $E_a$ or higher $T$ gives a larger $k$; the change in $k$ is **exponential**.
- (Beyond the syllabus, read off NCERT Fig. 3.7) $E_{a,b} = E_{a,f} - \Delta_r H$. For an exothermic reaction, the backward $E_a$ is larger than the forward one.

## Catalysts

:::trap
A catalyst **does not** change $\Delta H$, $\Delta G$ or the equilibrium constant $K$. It lowers $E_a$ for the forward and the backward reaction **by the same amount**, so both speed up and equilibrium is only reached sooner.
:::

- A catalyst can't start a non-spontaneous reaction.
- A substance that slows a reaction is an **inhibitor**. NCERT says the word "catalyst" should not be used for it.

## Collision theory

- Effective collision = enough energy (**threshold energy**) + **proper orientation**.
- $P$ (steric factor) corrects for orientation; $Z_{AB}$ is collision frequency; $A$ in the Arrhenius equation is related to $Z_{AB}$.
- Rate $= Z_{AB}e^{-E_a/RT}$ works well for atoms and simple molecules. For complex molecules it deviates, because not every energetic collision is properly oriented; $P$ fixes this.
- Drawback of the theory: it treats molecules as hard spheres and ignores their structure.

## NCERT lines to know

:::remember
- "Rate law ... must be determined experimentally."
- Thermodynamics tells feasibility; kinetics tells rate. Diamond → graphite is feasible but imperceptibly slow.
- Reactions of molecularity three are very rare and slow: three species seldom collide at the same moment.
- The slowest step is the **rate determining step**.
- For a 10° rise in temperature, the rate constant nearly doubles.
- Collision theory: Max Trautz and William Lewis, 1916–18.
- The Arrhenius equation was first proposed by van't Hoff.
:::
