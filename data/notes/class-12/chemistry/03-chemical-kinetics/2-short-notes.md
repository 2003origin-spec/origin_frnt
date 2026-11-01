---
title: "Chemical Kinetics: Short Notes"
type: short_notes
chapter: c12.chemistry.chemical-kinetics
order: 2
---

## 1. What kinetics tells us

- **Thermodynamics** tells whether a reaction is feasible ($\Delta G < 0$ at constant T and p). **Equilibrium** tells how far it goes. **Chemical kinetics** tells how fast it goes, and by what steps (the mechanism).
- Diamond should turn into graphite ($\Delta G < 0$), but the change is so slow that it is never seen. Feasible does not mean fast.
- Speeds vary: AgCl precipitation is instant, rusting is very slow, inversion of cane sugar is moderate.

## 2. Rate of a reaction

- **Rate** = change in concentration of a reactant or product per unit time. Units: mol L⁻¹ s⁻¹; for gases, atm s⁻¹ (partial pressure is proportional to concentration at constant T).
- **Average rate** $= -\Delta[R]/\Delta t$ over an interval. It falls as the reaction goes on, because the reactant is used up.
- **Instantaneous rate** $= -d[R]/dt$ at one moment: the slope of the tangent to the concentration–time curve at that time.
- When coefficients differ, divide each rate by its coefficient so that one rate describes the whole reaction:

$$\ce{2HI(g) -> H2(g) + I2(g)}$$
$$\text{Rate} = -\frac{1}{2}\frac{\Delta[\ce{HI}]}{\Delta t}$$
$$\text{Rate} = +\frac{\Delta[\ce{H2}]}{\Delta t}$$
$$\text{Rate} = +\frac{\Delta[\ce{I2}]}{\Delta t}$$

## 3. What affects the rate

1. **Concentration** of reactants (pressure, for gases);
2. **Temperature**;
3. **Catalyst**.

## 4. Rate law and rate constant

- **Rate law (rate equation, rate expression):** Rate $= k[A]^x[B]^y$. It gives the rate in terms of molar concentrations of reactants, each raised to a power.
- The powers $x, y$ **may or may not** equal the coefficients. The rate law must be found **by experiment**; it cannot be read off the balanced equation.
- **Rate constant $k$:** the rate when every concentration is 1 mol L⁻¹. It depends on temperature and catalyst, not on concentration.

**Initial rate method (NCERT Table 3.2)** for $\ce{2NO + O2 -> 2NO2}$: doubling [NO] (O₂ fixed) makes the rate 4 times, so order 2 in NO. Doubling [O₂] (NO fixed) doubles the rate, so order 1 in O₂. Rate $= k[\ce{NO}]^2[\ce{O2}]$. Here the powers happen to equal the coefficients.

| Reaction | Experimental rate law |
| --- | --- |
| Chloroform + chlorine (gives $\ce{CCl4}$) | $k[\ce{CHCl3}][\ce{Cl2}]^{1/2}$ |
| Ester + water (hydrolysis) | $k[\ce{CH3COOC2H5}][\ce{H2O}]^0$ |

In these two, the powers are **not** the coefficients.

## 5. Order of a reaction

- **Order** = sum of the powers of the concentrations in the rate law. The power on one reactant is the order with respect to that reactant.
- It shows how sensitive the rate is to each concentration.
- Values: 0, 1, 2, 3, or a fraction. Rate $= k[A]^{1/2}[B]^{3/2}$ is second order; Rate $= k[A]^{3/2}[B]^{-1}$ is half order.
- **Zero order:** the rate does not depend on concentration at all.

## 6. Elementary and complex reactions

- **Elementary reaction:** takes place in one step.
- **Complex reaction:** a sequence of elementary steps (the **mechanism**) gives the products. Types: consecutive (ethane → alcohol → aldehyde → acid → CO₂ + H₂O), reverse, and side reactions (nitration of phenol gives both o- and p-nitrophenol).
- **Rate-determining step:** the **slowest** step controls the overall rate, like the slowest runner in a relay team.

**Decomposition of H₂O₂ (iodide catalysed, alkaline medium):**
$$\begin{aligned} & \ce{2H2O2} \\ & \ce{->[I^-][alkaline] 2H2O + O2} \end{aligned}$$
$$\text{Rate} = k[\ce{H2O2}][\ce{I-}]$$
Mechanism (both steps bimolecular). Step 1, slow:
$$\ce{H2O2 + I- -> H2O + IO-}$$
Step 2, fast:
$$\begin{aligned} & \ce{H2O2 + IO-} \\ & \ce{-> H2O + I- + O2} \end{aligned}$$
$\ce{IO-}$ is an **intermediate**: formed and used up during the reaction, absent from the overall equation. The slow first step fixes the rate law.

## 7. Molecularity

- **Molecularity** = number of reacting species (atoms, ions or molecules) that must **collide at the same time** in an **elementary** reaction.
- Unimolecular: $\ce{NH4NO2 -> N2 + 2H2O}$. Bimolecular: $\ce{2HI -> H2 + I2}$. Termolecular: $\ce{2NO + O2 -> 2NO2}$.
- Even three species colliding at the same moment is unlikely, so molecularity 3 is rare and slow; more than three almost never happens. So a reaction with more than three molecules in its equation must go in several steps:

$$\begin{aligned} & \ce{KClO3 + 6FeSO4 + 3H2SO4} \\ & \ce{-> KCl + 3Fe2(SO4)3 + 3H2O} \end{aligned}$$
It looks "tenth order", but it is actually **second order**.

| | Order | Molecularity |
| --- | --- | --- |
| Found by | Experiment | Theory (the mechanism) |
| Values | 0, whole number, fraction | 1, 2 or 3 only |
| Applies to | Elementary and complex | Elementary only |

For a complex reaction, the order is set by the slowest step, and equals that step's molecularity. For an elementary reaction, order = molecularity.

## 8. Integrated rate equations

Instantaneous rates (tangent slopes) are hard to measure, so the rate law is integrated to link concentration directly to time. NCERT and both syllabi cover only **zero** and **first** order.

**Zero order:** $[R] = [R]_0 - kt$.
- $[R]$ vs $t$ is a straight line with slope $-k$.
- Uncommon; seen under special conditions: some enzyme-catalysed reactions, and reactions on metal surfaces.
- $\ce{NH3}$ on hot platinum at high pressure: the surface is saturated with gas, so more ammonia can't increase the rate. Rate $= k[\ce{NH3}]^0 = k$.

$$\begin{aligned} & \ce{2NH3(g)} \\ & \ce{->[1130 K][Pt] N2(g) + 3H2(g)} \end{aligned}$$
- Thermal decomposition of HI on a **gold** surface is also zero order.

**First order:** $\ln[R] = \ln[R]_0 - kt$, or $[R] = [R]_0e^{-kt}$.
- $\ln[R]$ vs $t$ is a straight line with slope $-k$.
- Examples: hydrogenation of ethene (Rate $= k[\ce{C2H4}]$), decomposition of $\ce{N2O5}$ and $\ce{N2O}$, and **all radioactive decay**:
$$\begin{aligned} & \ce{^{226}_{88}Ra} \\ & \ce{-> ^{4}_{2}He + ^{222}_{86}Rn} \end{aligned}$$
- For a gas reaction $\ce{A(g) -> B(g) + C(g)}$ followed by total pressure: $p_A = 2p_i - p_t$, then use the first-order equation with pressures.

| Property | Zero order | First order |
| --- | --- | --- |
| Rate law | Rate $= k$ | Rate $= k[R]$ |
| Straight-line plot | $[R]$ vs $t$ | $\ln[R]$ vs $t$ |
| Half-life | $[R]_0/2k$ | $0.693/k$ |
| $t_{1/2}$ and $[R]_0$ | Proportional | Independent |
| Units of $k$ | mol L⁻¹ s⁻¹ | s⁻¹ |

## 9. Half-life

- **Half-life** $t_{1/2}$: time for the concentration of a reactant to fall to half its initial value.
- Zero order: $t_{1/2} = [R]_0/2k$, grows with $[R]_0$.
- First order: $t_{1/2} = 0.693/k$, the same whatever the starting concentration. So equal times remove equal **fractions**: after 1, 2, 3 half-lives, $\tfrac12$, $\tfrac14$, $\tfrac18$ is left.

## 10. Pseudo first order reactions

A reaction that is really of higher order but behaves as first order, because one reactant is in such large excess that its concentration hardly changes.
- **Acid hydrolysis of ethyl acetate:** 0.01 mol ester with 10 mol water; water only falls from 10 to 9.99 mol. Rate depends on the ester only.
$$\begin{aligned} & \ce{CH3COOC2H5 + H2O} \\ & \ce{->[H+] CH3COOH + C2H5OH} \end{aligned}$$
- **Inversion of cane sugar** (Rate $= k[\ce{C12H22O11}]$):
$$\begin{aligned} & \ce{C12H22O11 + H2O} \\ & \ce{->[H+] C6H12O6 + C6H12O6} \end{aligned}$$
The products are glucose and fructose.

## 11. Effect of temperature

- Most reactions go faster when heated. A 10° rise nearly **doubles** $k$. $\ce{N2O5}$: $t_{1/2}$ is 12 min at 50 °C, 5 h at 25 °C, 10 days at 0 °C.
- **Arrhenius equation** $k = Ae^{-E_a/RT}$, first proposed by van't Hoff; Arrhenius gave its physical meaning.
- Reactants pass through an unstable **activated complex** (for $\ce{H2 + I2 -> 2HI}$, an H₂–I₂ complex that breaks into two HI). **Activation energy** $E_a$ = energy needed to form it = energy of the activated complex minus energy of the reactants.
- In the potential energy vs reaction coordinate plot, $E_a$ is the barrier height. The overall enthalpy change depends only on reactants and products.

**Maxwell–Boltzmann distribution** (fraction of molecules vs kinetic energy):
- the peak is the **most probable** kinetic energy;
- on heating, the peak moves to higher energy and the curve **broadens** (spreads right);
- the **total area stays the same** (total probability is 1);
- at $t + 10$, the area beyond $E_a$ (molecules able to react) roughly **doubles**, so the rate roughly doubles.

$e^{-E_a/RT}$ is the fraction of molecules with energy $\ge E_a$. Raising $T$ or lowering $E_a$ increases $k$ **exponentially**. A plot of $\ln k$ vs $1/T$ is a straight line: slope $-E_a/R$, intercept $\ln A$.

## 12. Catalysts

- A **catalyst** increases the rate without any permanent chemical change in itself. Example: $\ce{MnO2}$ in $\ce{2KClO3 -> 2KCl + 3O2}$.
- A substance that slows a reaction is an **inhibitor**; NCERT says not to call it a catalyst.
- **Intermediate complex theory:** the catalyst forms temporary bonds with reactants, giving a short-lived intermediate complex that breaks into products and gives the catalyst back.
- It provides an **alternate path with lower $E_a$**, so (by Arrhenius) the rate rises.
- A small amount catalyses a large amount of reactant.
- It does **not** change $\Delta G$ or the equilibrium constant. It speeds up the forward and backward reactions **equally**, so equilibrium is reached sooner, at the same position.
- It catalyses spontaneous reactions only; it can't make a non-spontaneous reaction happen.

## 13. Collision theory

- By Max Trautz and William Lewis (1916–18), based on the kinetic theory of gases. Molecules are treated as **hard spheres**; a reaction happens when they collide.
- **Collision frequency $Z$:** number of collisions per second per unit volume.
- For $\ce{A + B -> Products}$: Rate $= Z_{AB}e^{-E_a/RT}$. So the Arrhenius factor $A$ is related to collision frequency.
- This works for atoms and simple molecules, but not for complex ones: not every collision gives products.
- **Effective collisions** need both (i) energy at least the **threshold energy** and (ii) **proper orientation**. Example (NCERT Fig. 3.12): $\ce{CH3Br + OH-}$ gives methanol only when $\ce{OH-}$ approaches carbon from the side **opposite** Br. Hitting the Br end, the molecules just bounce apart. (The NCERT text names it "bromoethane", but the equation in the figure uses $\ce{CH3Br}$, bromomethane, which is the one that gives methanol.)
- The **steric (probability) factor $P$** accounts for orientation: Rate $= PZ_{AB}e^{-E_a/RT}$.
- Drawback: it treats molecules as hard spheres and ignores their structure.
