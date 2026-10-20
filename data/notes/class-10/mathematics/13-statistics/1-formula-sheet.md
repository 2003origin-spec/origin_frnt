---
title: "Statistics: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.statistics
order: 1
---

## Symbols used

$x_i$ = an observation or a class mark, $f_i$ = its frequency, $\Sigma$ = "sum of", $n = \Sigma f_i$ = total number of observations, $\bar{x}$ = mean, $h$ = class size.

## Before you start

:::formula{title="Class mark (mid-point)"}
$$x_i = \frac{L + U}{2}$$
$L$ = lower class limit, $U$ = upper class limit.

For the class 10 – 25, the class mark is $\dfrac{10 + 25}{2} = 17.5$. The class mark stands for every value in its class.
:::

:::formula{title="Class size"}
$$h = \text{upper limit} - \text{lower limit}$$
For 10 – 25, $h = 15$.

This works for continuous classes. For classes with gaps, such as 118 – 126, 127 – 135, first make them continuous (117.5 – 126.5, ...). Then $h = 9$, not $126 - 118 = 8$.
:::

## Mean of grouped data

:::formula{title="Direct method"}
$$\bar{x} = \frac{\Sigma f_i x_i}{\Sigma f_i}$$
Also the formula for ungrouped data with frequencies (then $x_i$ are the actual values). For grouped data, $x_i$ = class mark. Best when $x_i$ and $f_i$ are small.
:::

:::formula{title="Assumed mean method"}
$$d_i = x_i - a$$
$$\bar{x} = a + \frac{\Sigma f_i d_i}{\Sigma f_i}$$
$a$ = assumed mean: any one $x_i$, usually one near the centre. The answer does not depend on which $a$ you choose.
:::

:::formula{title="Step-deviation method"}
$$u_i = \frac{x_i - a}{h}$$
$$\bar{u} = \frac{\Sigma f_i u_i}{\Sigma f_i}$$
$$\bar{x} = a + h\,\bar{u}$$
Written in full:
$$\begin{aligned} \bar{x} &= a \\ &+ \left(\frac{\Sigma f_i u_i}{\Sigma f_i}\right) \times h \end{aligned}$$
Best when all the $d_i$ have a common factor $h$. If the class sizes are unequal, take $h$ = a number that divides every $d_i$.
:::

:::remember
All three methods give the **same** mean. The assumed mean and step-deviation methods are just shorter ways of doing the direct method.
:::

## Mode of grouped data

:::formula{title="Mode"}
$$\begin{aligned} \text{Mode} &= l \\ &+ \left(\frac{f_1 - f_0}{2f_1 - f_0 - f_2}\right) \times h \end{aligned}$$
- **Modal class** = the class with the highest frequency.
- $l$ = lower limit of the modal class
- $f_1$ = frequency of the modal class
- $f_0$ = frequency of the class just **before** it
- $f_2$ = frequency of the class just **after** it
- $h$ = class size

The book uses it only when all classes have the **same size**, and the classes must be continuous. The mode lies inside the modal class.
:::

## Median of grouped data

:::formula{title="Median"}
$$\begin{aligned} \text{Median} &= l \\ &+ \left(\frac{\frac{n}{2} - cf}{f}\right) \times h \end{aligned}$$
- **Median class** = the class whose cumulative frequency is greater than (and nearest to) $\dfrac{n}{2}$.
- $l$ = lower limit of the median class
- $n$ = number of observations ($\Sigma f_i$)
- $cf$ = cumulative frequency of the class just **before** the median class
- $f$ = frequency of the median class
- $h$ = class size

Classes must be continuous. The book uses it with equal class sizes.
:::

:::formula{title="Median of ungrouped data (Class 9 recap)"}
Arrange the values in ascending order. If $n$ is odd, the median is the value in position
$$\frac{n + 1}{2}$$
If $n$ is even, the median is the average of the two values in positions
$$\frac{n}{2} \ \text{ and } \ \frac{n}{2} + 1$$
:::

## Linking the three

:::formula{title="Empirical relationship"}
$$3\,\text{Median} = \text{Mode} + 2\,\text{Mean}$$
It is in the current book (as a Remark). It is approximate: it comes from experience, not a proof. Use it to estimate one measure from the other two.
:::
