---
title: "Chemical Kinetics: Quick Practice"
type: practice
chapter: c12.chemistry.chemical-kinetics
order: 4
---

Try each question first, then tap **Show answer**. Use $R$ = 8.314 J K⁻¹ mol⁻¹, $\log 2 = 0.301$ and $\ln 2 = 0.693$.

## Rate and rate law

:::question{title="1. Rates from coefficients" exam="NEET level"}
For $\ce{4NH3 + 5O2 -> 4NO + 6H2O}$, oxygen is used up at $2.0 \times 10^{-3}$ mol L⁻¹ s⁻¹. Find the rate of the reaction and the rate of formation of water.

---

Rate $= \tfrac15 \times 2.0 \times 10^{-3} =$ **$4.0 \times 10^{-4}$ mol L⁻¹ s⁻¹**.

Water: $6 \times 4.0 \times 10^{-4} =$ **$2.4 \times 10^{-3}$ mol L⁻¹ s⁻¹**.
:::

:::question{title="2. Initial rates" exam="JEE Main level"}
For $\ce{A + B -> products}$:

| Exp. | [A] / mol L⁻¹ | [B] / mol L⁻¹ | Rate / mol L⁻¹ s⁻¹ |
| --- | --- | --- | --- |
| 1 | 0.10 | 0.10 | $2.0 \times 10^{-4}$ |
| 2 | 0.20 | 0.10 | $4.0 \times 10^{-4}$ |
| 3 | 0.10 | 0.30 | $1.8 \times 10^{-3}$ |

Find the rate law and $k$.

---

Exp. 1 → 2: [A] doubles, rate doubles, so order 1 in A. Exp. 1 → 3: [B] triples, rate goes up 9 times, so order 2 in B.

So **Rate $= k[A][B]^2$** (third order overall). From Exp. 1:

$k = \dfrac{2.0 \times 10^{-4}}{(0.10)(0.10)^2} =$ **0.20 mol⁻² L² s⁻¹**.
:::

:::question{title="3. Order from units" exam="NEET level"}
A rate constant has units mol$^{-1/2}$ L$^{1/2}$ s⁻¹. What is the overall order?

---

Units of $k$ are $(\text{mol L}^{-1})^{1-n}\,\text{s}^{-1}$. Here $(\text{mol L}^{-1})^{-1/2}$, so $1 - n = -\tfrac12$ and $n =$ **3/2**.
:::

:::question{title="4. Slow step" exam="NEET level"}
The reaction $\ce{NO2 + CO -> NO + CO2}$ goes in two steps. Step 1 (slow): $\ce{2NO2 -> NO3 + NO}$. Step 2 (fast): $\ce{NO3 + CO -> NO2 + CO2}$. Write the rate law. What is the order with respect to CO?

---

The slow step sets the rate: **Rate $= k[\ce{NO2}]^2$**. CO enters only after the slow step, so the order in CO is **zero**. (The slow step is bimolecular, matching the overall order 2.)
:::

## Integrated rate equations

:::question{title="5. 75% of a first order reaction" exam="NEET level"}
A first order reaction has $k = 2.31 \times 10^{-3}$ s⁻¹. How long does it take for 75% of the reactant to react?

---

$t_{1/2} = 0.693 / (2.31 \times 10^{-3}) = 300$ s. 75% reacted means $\tfrac14$ left, which is 2 half-lives: **600 s**.
:::

:::question{title="6. Zero order" exam="JEE Main level"}
In a zero order reaction, [R] falls from 0.60 to 0.45 mol L⁻¹ in 10 min. Find its half-life, and the time when the reactant is used up.

---

$k = (0.60 - 0.45)/10 = 0.015$ mol L⁻¹ min⁻¹.

$t_{1/2} = [R]_0/2k = 0.60/0.030 =$ **20 min**. Used up at $t = [R]_0/k = 0.60/0.015 =$ **40 min**.
:::

:::question{title="7. From total pressure" exam="JEE Main level"}
The first order reaction $\ce{A(g) -> B(g) + C(g)}$ starts with pure A at 0.40 atm in a closed vessel at constant temperature. After 200 s the total pressure is 0.60 atm. Find $k$.

---

$p_A = 2p_i - p_t = 0.80 - 0.60 = 0.20$ atm, exactly half of 0.40. So $t_{1/2} = 200$ s.

$k = 0.693/200 =$ **$3.47 \times 10^{-3}$ s⁻¹**.
:::

:::question{title="8. Half-life from 90%" exam="NEET level"}
A first order reaction is 90% complete in 46.06 min. Find its half-life.

---

$k = \dfrac{2.303}{46.06}\log\dfrac{100}{10} = 0.0500$ min⁻¹.

$t_{1/2} = 0.693/0.0500 =$ **13.86 min**.
:::

## Temperature and catalyst

:::question{title="9. Activation energy" exam="NEET level"}
A rate constant doubles when the temperature goes from 300 K to 310 K. Find $E_a$.

---

$\log 2 = \dfrac{E_a}{2.303R} \times \dfrac{310 - 300}{300 \times 310}$

$E_a = \dfrac{0.301 \times 19.15 \times 93000}{10} \approx 5.36 \times 10^4$ J mol⁻¹ $=$ **53.6 kJ mol⁻¹**.
:::

:::question{title="10. Catalyst lowers Ea" exam="JEE Main level"}
At 300 K a catalyst lowers $E_a$ from 100 kJ mol⁻¹ to 80 kJ mol⁻¹. Assuming $A$ is unchanged, about how many times faster is the catalysed reaction?

---

$\dfrac{k_{cat}}{k} = e^{(E_a - E_{a,cat})/RT}$, so $\log\dfrac{k_{cat}}{k} = \dfrac{20000}{2.303 \times 8.314 \times 300} = 3.48$

$k_{cat}/k = 10^{3.48} \approx$ **$3 \times 10^3$ times** faster.
:::
