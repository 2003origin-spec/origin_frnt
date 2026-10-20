---
title: "Statistics: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.statistics
order: 1
---

Symbols as in NCERT: $\bar x$ = mean, $M$ = median, $\sigma$ = standard deviation, $\sigma^2$ = variance. For $n$ single observations $x_1, \dots, x_n$. For a frequency table, $x_i$ occurs $f_i$ times and $N = \sum f_i$. For classes, $x_i$ is the **mid-point** of the class.

## Central tendency (recap)

:::formula{title="Mean"}
$$\bar x = \frac{1}{n}\sum_{i=1}^{n} x_i$$
$$\bar x = \frac{1}{N}\sum_{i=1}^{n} f_i x_i$$
The second form is for a frequency table, with $N = \sum f_i$.
:::

:::formula{title="Mean by step-deviation"}
$$d_i = \frac{x_i - a}{h}$$
$$\bar x = a + \frac{\sum f_i d_i}{N} \times h$$
$a$ = assumed mean, $h$ = common factor (usually the class width). For single observations, use $n$ in place of $N$ and drop the $f_i$.
:::

:::formula{title="Median of single observations"}
Arrange the data in order first.
- $n$ odd: median = $\left(\dfrac{n+1}{2}\right)$th observation.
- $n$ even: median = mean of the $\left(\dfrac{n}{2}\right)$th and $\left(\dfrac{n}{2} + 1\right)$th observations.
:::

:::formula{title="Median of a continuous distribution"}
$$M = l + \frac{\frac{N}{2} - C}{f} \times h$$
Median class = the class whose cumulative frequency is equal to or just greater than $N/2$. $l$ = its lower limit, $f$ = its frequency, $h$ = its width, $C$ = cumulative frequency of the class **before** it. Classes must be continuous (no gaps).
:::

:::formula{title="Mode of a continuous distribution"}
Class 10 recap, not in this chapter:
$$\text{Mode} = l + \frac{f_1 - f_0}{2f_1 - f_0 - f_2} \times h$$
$l$ = lower limit of the modal class (highest frequency), $f_1$ = its frequency, $f_0$ and $f_2$ = frequencies of the classes before and after it, $h$ = class width (all classes of equal width).
:::

## Range

:::formula{title="Range"}
$$\text{Range} = x_{\max} - x_{\min}$$
$x_{\max}$ = largest observation, $x_{\min}$ = smallest. It uses only these two values.
:::

## Mean deviation

:::formula{title="Mean deviation about a"}
$$\text{M.D.}(a) = \frac{1}{n}\sum_{i=1}^{n} |x_i - a|$$
Usually $a = \bar x$ (gives M.D.$(\bar x)$) or $a = M$ (gives M.D.$(M)$).
:::

:::formula{title="Mean deviation for a frequency table"}
$$\text{M.D.}(\bar x) = \frac{1}{N}\sum f_i\,|x_i - \bar x|$$
$$\text{M.D.}(M) = \frac{1}{N}\sum f_i\,|x_i - M|$$
Same form for discrete and continuous tables. For classes, $x_i$ = mid-point.
:::

## Variance and standard deviation

:::formula{title="Single observations"}
$$\sigma^2 = \frac{1}{n}\sum_{i=1}^{n} (x_i - \bar x)^2$$
$$\sigma^2 = \frac{1}{n}\sum_{i=1}^{n} x_i^2 - \bar x^{\,2}$$
$\sigma = \sqrt{\sigma^2}$, the positive square root. $\sigma$ has the same unit as the data; $\sigma^2$ has the unit squared. NCERT divides by $n$, not $n - 1$.
:::

:::formula{title="Frequency table"}
$$\sigma^2 = \frac{1}{N}\sum f_i (x_i - \bar x)^2$$
$$\sigma^2 = \frac{1}{N}\sum f_i x_i^2 - \bar x^{\,2}$$
For a continuous table, $x_i$ = mid-point of each class.
:::

:::formula{title="Standard deviation without the mean first"}
$$\sigma = \frac{1}{N}\sqrt{N\sum f_i x_i^2 - (\sum f_i x_i)^2}$$
NCERT formula (3). Useful when $\bar x$ is not a whole number.
:::

:::formula{title="Shortcut (step-deviation) method"}
$$y_i = \frac{x_i - A}{h}$$
$$\bar x = A + h\,\bar y$$
$$\sigma_x = h\,\sigma_y$$
$$\begin{aligned}\sigma_x^2 = \frac{h^2}{N^2}\Big[&N\sum f_i y_i^2 \\ &- \Big(\sum f_i y_i\Big)^2\Big]\end{aligned}$$
$A$ = assumed mean, $h$ = class width (or common factor), $h > 0$.
:::

## Change of origin and scale

:::formula{title="New data y = ax + b"}
$$\bar y = a\,\bar x + b$$
$$\sigma_y^2 = a^2\,\sigma_x^2$$
$$\sigma_y = |a|\,\sigma_x$$
Adding $b$ to every observation shifts the mean but does **not** change $\sigma$. Multiplying by $a$ multiplies the variance by $a^2$. Mean deviation (about the mean or the median) behaves like $\sigma$: it gets multiplied by $|a|$.
:::

## Standard results

:::formula{title="First n natural numbers"}
$$\text{Mean} = \frac{n + 1}{2}$$
$$\sigma^2 = \frac{n^2 - 1}{12}$$
From NCERT Exercise 13.2. For an AP with common difference $d$ and $n$ terms (exam extra, follows from the change-of-scale rule): $\sigma^2 = \dfrac{d^2(n^2 - 1)}{12}$.
:::

:::formula{title="Correcting wrong observations"}
$$\sum x_i = n\,\bar x$$
$$\sum x_i^2 = n\left(\sigma^2 + \bar x^{\,2}\right)$$
Find these from the wrong values, remove the wrong items, add the right ones, then recompute $\bar x$ and $\sigma^2$.
:::

## Beyond NCERT

:::formula{title="Combined mean of two groups"}
Exam extra: not in NCERT, but a common JEE Main use of the mean and variance formulas.
$$\bar x = \frac{n_1\bar x_1 + n_2\bar x_2}{n_1 + n_2}$$
:::

:::formula{title="Combined variance of two groups"}
$$d_1 = \bar x_1 - \bar x$$
$$d_2 = \bar x_2 - \bar x$$
$$\begin{aligned}\sigma^2 = \frac{1}{n_1 + n_2}\Big[&n_1(\sigma_1^2 + d_1^2) \\ &+ n_2(\sigma_2^2 + d_2^2)\Big]\end{aligned}$$
Exam extra, like the combined mean. $\bar x$ = combined mean; $n_1, \bar x_1, \sigma_1$ belong to group 1, $n_2, \bar x_2, \sigma_2$ to group 2. Variances here are the NCERT kind (divide by $n$).
:::

:::formula{title="Coefficient of variation"}
$$\text{C.V.} = \frac{\sigma}{\bar x} \times 100$$
Use it for data with $\bar x > 0$. Of two series, the one with the **greater** C.V. is more variable (less consistent).

Beyond the syllabus: this section was removed from the rationalised NCERT book, and the JEE Main 2026 syllabus does not name it (it only says "measures of dispersion"). Older JEE Main papers did use it, so know the definition.
:::
