---
title: "Linear Inequalities: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.linear-inequalities
order: 1
---

A Board exam chapter. JEE Main does not list it, but these rules are used whenever you find a domain or a range, or solve a quadratic inequality.

Unless the question says otherwise, solve in the set of **real numbers** (NCERT's rule for this chapter).

## The two rules

:::formula{title="Rule 1: add or subtract"}
$$a < b \;\Rightarrow\; a + c < b + c$$
$$a < b \;\Rightarrow\; a - c < b - c$$
Works for any real $c$. The sign does **not** change. Same for $>$, $\le$, $\ge$.
:::

:::formula{title="Rule 2: multiply or divide by a positive number"}
$$a < b,\ k > 0 \;\Rightarrow\; ka < kb$$
$$a < b,\ k > 0 \;\Rightarrow\; \frac{a}{k} < \frac{b}{k}$$
The sign stays the same.
:::

:::formula{title="Rule 2: multiply or divide by a negative number"}
$$a < b,\ k < 0 \;\Rightarrow\; ka > kb$$
$$a < b,\ k < 0 \;\Rightarrow\; \frac{a}{k} > \frac{b}{k}$$
The sign is **reversed**: $<$ becomes $>$, $\le$ becomes $\ge$. Example: $3 > 2$ but $-3 < -2$.
:::

## Solving one linear inequality

:::formula{title="ax + b < 0 (a not zero)"}
$$a > 0:\quad x < -\frac{b}{a}$$
$$a < 0:\quad x > -\frac{b}{a}$$
The same pattern holds for $>$, $\le$ and $\ge$: dividing by a negative $a$ flips the sign.
:::

:::formula{title="Double inequality, k > 0"}
$$c < kx + m < d$$
$$\frac{c - m}{k} < x < \frac{d - m}{k}$$
Do the same step to **all three parts**. If $k < 0$, both signs flip, and you rewrite the answer from smaller to larger.
:::

:::formula{title="System of inequalities (AND)"}
$$\text{Solution} = S_1 \cap S_2$$
$S_1$, $S_2$ are the solution sets of each inequality. Take only the values common to both. If nothing is common, the system has **no solution**.
:::

## Writing the answer

| Inequality | Interval | Number line |
|---|---|---|
| $x < a$ | $(-\infty, a)$ | open circle at $a$, left |
| $x \le a$ | $(-\infty, a]$ | dark circle at $a$, left |
| $x > a$ | $(a, \infty)$ | open circle at $a$, right |
| $x \ge a$ | $[a, \infty)$ | dark circle at $a$, right |
| $a \le x < b$ | $[a, b)$ | dark at $a$, open at $b$ |

Round bracket = end point not included. Square bracket = included. $\pm\infty$ always gets a round bracket.

## Formulas used in NCERT word problems

:::formula{title="Average of marks"}
$$\frac{m_1 + m_2 + \cdots + m_{n-1} + x}{n} \ge A$$
$x$ = marks still needed, $A$ = target average ("at least" means $\ge$).
:::

:::formula{title="Celsius and Fahrenheit"}
$$C = \frac{5}{9}\,(F - 32)$$
$$F = \frac{9}{5}\,C + 32$$
Put the range of one scale into the formula and solve for the other.
:::

:::formula{title="Mixing solutions"}
$$\text{amount of acid} = \frac{p}{100} \times V$$
$p$ = percent strength, $V$ = volume in litres.

You add $x$ litres to $V_1$ litres, so the mixture has $V_1 + x$ litres. For its strength to be more than $p_1\%$ but less than $p_2\%$:
$$\begin{aligned} \tfrac{p_1}{100}(V_1 + x) &< \text{acid} \\ \text{acid} &< \tfrac{p_2}{100}(V_1 + x) \end{aligned}$$
Water adds volume but no acid. If the question says "at least" or "at most", use $\le$ instead of $<$.
:::

:::formula{title="Intelligence quotient"}
$$\text{IQ} = \frac{\text{MA}}{\text{CA}} \times 100$$
MA = mental age, CA = chronological age (both in years).
:::

## Exam extras (not in NCERT)

:::formula{title="Reciprocals (exam extra)"}
$$0 < a < b \;\Rightarrow\; \frac{1}{a} > \frac{1}{b}$$
$$a < b < 0 \;\Rightarrow\; \frac{1}{a} > \frac{1}{b}$$
The sign flips only when $a$ and $b$ have the **same sign**. If $a < 0 < b$, there is no flip: $-2 < 3$ and $-\frac12 < \frac13$.
:::

:::formula{title="Squaring (exam extra)"}
$$0 \le a < b \;\Rightarrow\; a^2 < b^2$$
Safe only when both sides are non-negative. Otherwise the sign can change: $-3 < 2$ but $9 > 4$.
:::

:::formula{title="Modulus (exam extra)"}
For $a > 0$:
$$|x| < a \iff -a < x < a$$
$$|x| > a \iff x < -a \text{ or } x > a$$
With $\le$ and $\ge$, the end points $\pm a$ are included.
:::
