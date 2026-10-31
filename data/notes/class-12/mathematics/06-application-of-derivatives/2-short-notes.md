---
title: "Application of Derivatives: Short Notes"
type: short_notes
chapter: c12.mathematics.application-of-derivatives
order: 2
---

## 0. What is in this chapter now

- The rationalised NCERT book (reprint 2025-26) keeps three topics: **rate of change**, **increasing and decreasing functions**, and **maxima and minima**.
- **Tangents and normals** and **approximations** were removed (the chapter's introduction still mentions them, but their sections are gone). The JEE Main 2026 syllabus also lists only the three topics above, so you can skip them.

## 1. Rate of change

- If $y = f(x)$, then $\dfrac{dy}{dx}$ (or $f'(x)$) is the **rate of change of $y$ with respect to $x$**. Its value at $x = x_0$ is $f'(x_0)$.
- $\dfrac{dy}{dx}$ is **positive** if $y$ increases as $x$ increases, and **negative** if $y$ decreases.
- If $x$ and $y$ both depend on $t$: $\dfrac{dy}{dx} = \dfrac{dy/dt}{dx/dt}$, when $\dfrac{dx}{dt} \ne 0$.

**Method for "how fast" questions (related rates):**
1. Name the quantities and write what is given, with signs (a decreasing quantity has a **negative** rate).
2. Write one equation linking the quantities, true at **every** instant.
3. Differentiate both sides with respect to $t$ (chain rule).
4. Only now put in the values at the given instant.

:::example{title="Cube"}
The volume of a cube grows at 9 cm³/s. How fast does its surface grow when the edge is 10 cm?

$V = x^3$ gives $9 = 3x^2\,\dfrac{dx}{dt}$, so $\dfrac{dx}{dt} = \dfrac{3}{x^2}$.

$S = 6x^2$ gives $\dfrac{dS}{dt} = 12x \cdot \dfrac{3}{x^2} = \dfrac{36}{x}$. At $x = 10$: **3.6 cm²/s**.
:::

## 2. Marginal cost and marginal revenue

- **Marginal cost (MC)** is the instantaneous rate of change of total cost with respect to output: $MC = \dfrac{dC}{dx}$.
- **Marginal revenue (MR)** is the rate of change of total revenue with respect to the number of units sold: $MR = \dfrac{dR}{dx}$.
- Find the derivative first, then put in the value of $x$.

:::example{title="Marginal revenue"}
$R(x) = 3x^2 + 36x + 5$. Then $MR = 6x + 36$, and at $x = 5$, $MR = 66$, that is ₹66.
:::

## 3. Increasing and decreasing: definitions

For an interval I in the domain of $f$, and all $x_1 < x_2$ in I:

| Name | Condition |
|---|---|
| increasing | $f(x_1) \le f(x_2)$ |
| strictly increasing | $f(x_1) < f(x_2)$ |
| decreasing | $f(x_1) \ge f(x_2)$ |
| strictly decreasing | $f(x_1) > f(x_2)$ |

- **Constant** on I: $f(x) = c$ for all $x$ in I.
- $f$ is increasing (decreasing) **at a point** $x_0$ if it is increasing (decreasing) on some open interval containing $x_0$.
- A **monotonic** function on I is either increasing on I or decreasing on I.

:::remember
NCERT's "increasing" allows equal values (it means "never goes down"). "Strictly increasing" does not. Many exam questions say "increasing" when they mean strictly increasing; read the options carefully.
:::

## 4. Finding intervals with f′

**Theorem 1.** If $f$ is continuous on $[a, b]$ and differentiable on $(a, b)$:
- $f' \ge 0$ on $(a, b)$ gives increasing on $[a, b]$;
- $f' \le 0$ gives decreasing; $f' = 0$ gives constant.
- If $f' > 0$ ($f' < 0$) on $(a, b)$, $f$ is strictly increasing (strictly decreasing).

The proof uses the Mean Value Theorem (Chapter 5).

**Method:**
1. Find $f'(x)$ and factorise it.
2. Solve $f'(x) = 0$ (and note points where $f'$ is not defined).
3. These points cut the domain into intervals. Find the sign of $f'$ in each one (test one value).
4. $+$ means increasing, $-$ means decreasing.

:::example{title="A cubic"}
$f(x) = 4x^3 - 6x^2 - 72x + 30$, so $f'(x) = 12(x - 3)(x + 2)$.

| Interval | Sign of $f'$ | $f$ is |
|---|---|---|
| $(-\infty, -2)$ | $+$ | increasing |
| $(-2, 3)$ | $-$ | decreasing |
| $(3, \infty)$ | $+$ | increasing |

So $f$ is neither increasing nor decreasing on all of $\mathbb{R}$.
:::

- For a trigonometric function, solve $f'(x) = 0$ **inside the given interval only**. Example: $\cos x$ is decreasing on $(0, \pi)$, increasing on $(\pi, 2\pi)$, and neither on $(0, 2\pi)$.

## 5. Maximum and minimum values

- $f(c)$ is the **maximum value** of $f$ on I if $f(c) \ge f(x)$ for all $x$ in I; the **minimum value** if $f(c) \le f(x)$ for all $x$ in I. Either one is an **extreme value**, and $c$ is an **extreme point**.
- A function may have no maximum or minimum. $f(x) = x^2$ on $\mathbb{R}$ has minimum 0 and no maximum. $f(x) = x$ on $(0, 1)$ has neither.
- Every monotonic function takes its maximum and minimum values at the end points of its domain (if the end points are included).
- Every continuous function on a **closed** interval has a maximum and a minimum value.
- A maximum or minimum can occur where $f$ is not differentiable: $|x|$ has minimum 0 at $x = 0$.

## 6. Local maxima and minima

- Let $c$ be an **interior** point of the domain. $c$ is a point of **local maxima** if, for some $h > 0$, $f(c) \ge f(x)$ for all $x$ in $(c - h, c + h)$. Local minima: $f(c) \le f(x)$ there.
- On a graph these are the tops of "hills" and the bottoms of "valleys" (turning points).
- **Theorem 2:** if $f$ has a local maximum or minimum at $c$ inside an open interval, then $f'(c) = 0$ **or** $f$ is not differentiable at $c$.
- Such points are called **critical points**. The converse is false: $f(x) = x^3$ has $f'(0) = 0$, but 0 is neither.

## 7. First derivative test

At a critical point $c$ where $f$ is continuous, look at the sign of $f'$ just to the left and just to the right of $c$:

| Left of $c$ | Right of $c$ | At $c$ |
|---|---|---|
| $+$ | $-$ | local maximum |
| $-$ | $+$ | local minimum |
| same sign | same sign | neither (point of inflexion) |

:::example{title="Local max and min"}
$f(x) = x^3 - 3x + 3$, $f'(x) = 3(x - 1)(x + 1)$.

At $x = -1$, $f'$ goes $+$ to $-$: local maximum $f(-1) = 5$. At $x = 1$, $f'$ goes $-$ to $+$: local minimum $f(1) = 1$.
:::

- For $f(x) = 2x^3 - 6x^2 + 6x + 5$, $f'(x) = 6(x - 1)^2 \ge 0$. It never changes sign, so $x = 1$ is a point of inflexion, not an extremum.

## 8. Second derivative test

For $f$ twice differentiable at $c$ with $f'(c) = 0$:
- $f''(c) < 0$: local maximum. $f''(c) > 0$: local minimum.
- $f''(c) = 0$: the test **fails**. Use the first derivative test.
- Not usable where $f'(c)$ does not exist, for example $3 + |x|$ at 0. The first derivative test gives a local minimum value of 3 there.
- It is usually quicker than the first derivative test, but NCERT uses the first derivative test when $f''$ is messy (as for a distance with a square root).

## 9. Absolute maximum and minimum on [a, b]

- On $[a, b]$, the **absolute** (global) maximum is the greatest value of $f$ on the whole interval. It can be at an end point. A local maximum need not be the absolute maximum.
- **Working rule:** list the critical points in the interval and the two end points, find $f$ at each, then pick the largest and the smallest.

:::example{title="A cubic on [1, 5]"}
$f(x) = 2x^3 - 15x^2 + 36x + 1$, $f'(x) = 6(x - 2)(x - 3)$.

$f(1) = 24$, $f(2) = 29$, $f(3) = 28$, $f(5) = 56$. Absolute maximum **56** at $x = 5$; absolute minimum **24** at $x = 1$.
:::

- Critical points include points where $f'$ does not exist. For $12x^{4/3} - 6x^{1/3}$ on $[-1, 1]$, $x = 0$ must be checked along with $x = \frac18$.

## 10. Word problems on maxima and minima

1. Draw a figure. Choose **one** variable $x$ and write the quantity to optimise as a function of $x$ only (use the given condition to remove the other variables).
2. Write the allowed range of $x$ (lengths positive, cuts smaller than the sheet).
3. Solve $f'(x) = 0$; drop values outside the allowed range.
4. Confirm with the second (or first) derivative test, then answer what was asked: the value, or the dimensions.

:::example{title="Two poles"}
Vertical poles AP = 16 m and BQ = 22 m stand at A and B, with AB = 20 m. A point R on AB is $x$ m from A. Then $RP^2 + RQ^2 = 2x^2 - 40x + 1140$. Its derivative $4x - 40 = 0$ gives $x = 10$, and the second derivative is 4, positive, so the sum is least when AR = 10 m.
:::
