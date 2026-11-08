---
title: "Statistics: Important Points and Traps"
type: key_points
chapter: c10.mathematics.statistics
order: 3
---

## NCERT one-liners

:::remember
- For grouped data, each class is represented by its **class mark** (mid-point).
- Direct, assumed mean and step-deviation methods give the **same** mean. The value does not depend on the choice of $a$.
- The **modal class** has the highest frequency. The mode lies inside it.
- The **median class** is the class whose cumulative frequency is greater than (and nearest to) $\dfrac{n}{2}$.
- The mode can be less than, equal to or more than the mean.
- $3\,\text{Median} = \text{Mode} + 2\,\text{Mean}$ is an **empirical** (approximate) relation.
:::

:::remember
**Ogives are out.** The current book has no section on ogives (cumulative frequency graphs). Its introduction and end note still mention them, but there is no such section or exercise any more.
:::

## Mean

:::trap
In the direct method, multiply $f_i$ by the **class mark**, not by a class limit. For 20 – 30, use 25, not 20 or 30.
:::

:::trap
Divide by $\Sigma f_i$ (the total frequency), **not** by the number of classes.
:::

:::trap
In the assumed mean method, do not forget to **add $a$ back** at the end: $\bar{x} = a + \bar{d}$, where $\bar{d} = \dfrac{\Sigma f_i d_i}{\Sigma f_i}$.

In the step-deviation method, multiply by **$h$** before adding $a$: $\bar{x} = a + h\bar{u}$.
:::

:::trap
Keep the signs. Classes below $a$ have **negative** $d_i$ and $u_i$, so their $f_i d_i$ and $f_i u_i$ are negative too.
:::

- The mean of grouped data is approximate because of the mid-point assumption. The mean from the raw (ungrouped) data is the exact one.
- **Missing frequency** questions: write $\Sigma f_i$ and $\Sigma f_i x_i$ (or $\Sigma f_i u_i$) with the unknown, put them in the mean formula, and solve the linear equation.

## Mode

:::trap
$f_0$ is the class just **before** the modal class and $f_2$ is the class just **after** it. Do not take the next-highest frequencies from anywhere in the table.
:::

:::trap
The denominator is $2f_1 - f_0 - f_2$. A common slip is writing $f_1 - f_0 - f_2$.
:::

- **Check:** the mode must come out between the lower and upper limits of the modal class. If it does not, recheck your values.
- If the modal class is the first class, there is no class before it, so $f_0 = 0$. If it is the last class, $f_2 = 0$. (beyond the Class 10 book: no NCERT example has this case, but it is the usual rule.)

## Median

:::trap
$cf$ in the formula is the cumulative frequency of the class **before** the median class, not of the median class itself.
:::

:::trap
For grouped data, compare with $\dfrac{n}{2}$, not $\dfrac{n + 1}{2}$. The $\dfrac{n + 1}{2}$ rule is only for ungrouped data with $n$ odd.
:::

:::trap
Pick the first class whose cf is **greater than** $\dfrac{n}{2}$. If $n = 40$ and the cf values are 10, 20, 32, ..., then $\dfrac{n}{2} = 20$. The cf of 20 is equal, not greater, so the median class is the **third** class. (Here the median comes out the same either way, because it falls exactly on the class boundary. Still follow the rule.)
:::

- For "less than" data, the numbers given are cumulative frequencies. Find each class frequency by **subtracting** the cf before it.
- For "more than or equal to" data, the numbers are counts from the lower limits. Subtract the **next** number to get each class frequency.

:::trap
Classes like 118 – 126, 127 – 135 have gaps. Make them continuous first (117.5 – 126.5, ...). Then $l = 126.5$, not 127, and $h = 9$.
:::

- **Two unknowns** (like $x$ and $y$): one equation comes from the total $n$. The other comes from putting the given median in the median formula.
- A problem can set a starting value. In NCERT's insurance question, policies start at age 18, so "below 20" becomes the class 18 – 20.

## Handy shortcuts

:::tip
**Choosing $a$:** take the class mark with the highest frequency, or the one in the middle. One $d_i$ becomes 0 and the rest stay small.
:::

:::tip
**Quick check on a mean:** it must lie between the smallest and largest class marks. A mean outside that range means a slip.
:::

:::tip
**Mnemonic for the mode formula:** "**one** minus **zero**, over **two-one** minus **zero** minus **two**": $\dfrac{f_1 - f_0}{2f_1 - f_0 - f_2}$, then times $h$, plus $l$.
:::
