---
title: "Statistics: Important Points and Traps"
type: key_points
chapter: c11.mathematics.statistics
order: 3
---

## Mean deviation

:::remember
- The sum of deviations from the mean is always **zero**: $\sum (x_i - \bar x) = 0$. That is why mean deviation uses absolute values.
- NCERT: the sum of absolute deviations about the **median** is never more than the sum about the mean. (Exam extra: it is the smallest about any point.)
- In this chapter $M$ stands for the median.
:::

:::trap
For a frequency table, multiply each $|x_i - \bar x|$ by its frequency $f_i$ before adding, and divide by $N = \sum f_i$, not by the number of rows.
:::

:::trap
In the step-deviation method, the $d_i$ are only for finding $\bar x$. Do **not** use $|d_i|$ as the deviations: the M.D. needs $|x_i - \bar x|$ in the original units.
:::

## Median of grouped data

:::trap
- The median class is the first class whose cumulative frequency is **equal to or just greater than** $N/2$.
- $C$ is the cumulative frequency of the class **before** the median class, not of the median class itself.
- With gaps (16–20, 21–25, …), first make the classes continuous (15.5–20.5, 20.5–25.5, …). Otherwise $l$ and $h$ are wrong ($h = 5$ here, not 4).
:::

:::trap
For a discrete table with even $N$, the median is the mean of the $\frac{N}{2}$th and $\left(\frac N2 + 1\right)$th observations. Read both from the c.f. row; they can be different values.
:::

## Variance and standard deviation

:::remember
- Variance = mean of the squared deviations. NCERT divides by $n$ (or $N$), **not** $n - 1$.
- $\sigma$ is the **positive** square root of the variance.
- $\sigma^2 = 0$ only when all observations are equal.
- The unit of $\sigma$ is the unit of the data; the unit of $\sigma^2$ is that unit squared.
:::

:::tip
"Mean of the squares minus the square of the mean":
$$\sigma^2 = \overline{x^2} - \bar x^{\,2}$$
Here $\overline{x^2}$ is the mean of the $x_i^2$. If you get a negative variance, you have swapped the two terms or made an arithmetic slip.
:::

:::trap
$\sum x_i^2$ is not $\left(\sum x_i\right)^2$. In $N\sum f_i x_i^2 - \left(\sum f_i x_i\right)^2$, the first sum squares **each** value; the second squares the **total**.
:::

:::trap
Shortcut method: $\sigma_x = h\,\sigma_y$, but $\sigma_x^2 = h^2\,\sigma_y^2$. Multiply the S.D. by $h$, the variance by $h^2$. The assumed mean $A$ never appears in $\sigma$.
:::

## Change of origin and scale

:::remember
For $y_i = a x_i + b$:
- mean: $\bar y = a\bar x + b$;
- variance: $\sigma_y^2 = a^2 \sigma_x^2$;
- S.D. and mean deviation: multiplied by $|a|$.

Adding or subtracting a constant does **not** change the variance, S.D. or mean deviation.
:::

:::trap
For $y = 5 - 2x$ with $\sigma_x = 3$, the new S.D. is $|-2| \times 3 = 6$, not $-6$. The $+5$ has no effect on it.
:::

## Missing and wrong observations

:::trap
When a wrong value is corrected, change **both** $\sum x_i$ and $\sum x_i^2$. Then use the **new** mean in $\sigma^2 = \frac1n\sum x_i^2 - \bar x^{\,2}$. Using the old mean is a common slip.
:::

- If an observation is **dropped** (not replaced), $n$ also changes, to $n - 1$.
- Missing two observations: the answers $x = 4, y = 9$ and $x = 9, y = 4$ give the same set. State the two values, not two "solutions".

## Handy results

:::remember
- First $n$ natural numbers: mean $\dfrac{n+1}{2}$, variance $\dfrac{n^2 - 1}{12}$ (NCERT Exercise 13.2).
- First 10 multiples of 3 (also an NCERT exercise): mean $16.5$, variance $9 \times \dfrac{99}{12} = 74.25$.
- (Exam extra) An AP with common difference $d$ and $n$ terms: variance $\dfrac{d^2(n^2 - 1)}{12}$.
- Two numbers $a$ and $b$: $\sigma = \dfrac{|a - b|}{2}$ (direct from the definition).
:::

:::remember
Exam extras (not stated in NCERT):
- $\sum (x_i - a)^2$ is smallest when $a = \bar x$.
- M.D. about the mean $\le \sigma$.
- $\sigma \le \dfrac{\text{Range}}{2}$.
:::

:::remember
Beyond the syllabus (removed from the rationalised NCERT book; the JEE Main 2026 syllabus does not name it, but older papers used it): coefficient of variation $= \dfrac{\sigma}{\bar x} \times 100$, for $\bar x > 0$. Greater C.V. means **less** consistent.
:::

:::tip
Choose the assumed mean $A$ as the mid-point in the middle of the table (or near the highest frequency), and $h$ = class width. Then the $y_i$ are small whole numbers like $-2, -1, 0, 1, 2$.
:::
