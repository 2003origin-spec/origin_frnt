---
title: "Statistics: Short Notes"
type: short_notes
chapter: c11.mathematics.statistics
order: 2
---

## 1. Why we need dispersion

- Mean, median and mode are **measures of central tendency**. They tell us where the data is centred.
- They do not tell us how **spread out** the data is. Two batsmen can have the same mean and median score, but one scores 0 to 117 and the other 46 to 60.
- A single number that measures this spread is a **measure of dispersion**.
- NCERT lists four: range, quartile deviation, mean deviation and standard deviation. This chapter covers all except **quartile deviation**.

## 2. Range

- Range = maximum value − minimum value.
- It is quick, but it uses only the two extreme values. It says nothing about how the other values sit around the centre.

## 3. Mean deviation

- The deviation of $x$ from a fixed value $a$ is $x - a$.
- The sum of deviations from the **mean** is always 0, so the plain average of deviations is useless.
- So we drop the signs: **mean deviation** about $a$ is the mean of $|x_i - a|$.
- Any central value can be used for $a$. The mean and the median are the usual choices.

**Steps for single observations**
1. Find the central value $a$ (mean or median).
2. Find each deviation $x_i - a$.
3. Take absolute values $|x_i - a|$.
4. Add them and divide by $n$.

:::example{title="Mean deviation about the mean"}
Data: $2, 4, 7, 8, 9$. Mean $= 30/5 = 6$.

$|x_i - 6|$: $4, 2, 1, 2, 3$. Sum $= 12$.

M.D.$(\bar x) = 12/5 = 2.4$
:::

## 4. Mean deviation for grouped data

**Discrete frequency table** ($x_i$ occurs $f_i$ times):
- Mean: $\bar x = \dfrac{1}{N}\sum f_i x_i$, where $N = \sum f_i$.
- Median: write the cumulative frequencies (c.f.). NCERT's rule: the median is the observation whose c.f. is equal to or just greater than $N/2$. Careful when $N$ is even and some c.f. is **exactly** $N/2$: then the $\frac{N}{2}$th and $\left(\frac{N}{2} + 1\right)$th observations differ, and the median is their mean.
- Then M.D. $= \dfrac{1}{N}\sum f_i\,|x_i - a|$.

**Continuous frequency table** (classes):
- Assume each class is centred at its **mid-point**. Use the mid-points as $x_i$.
- Mean from the mid-points (the step-deviation method saves work).
- Median from $M = l + \dfrac{\frac{N}{2} - C}{f} \times h$.
- Then the same M.D. formula, with $x_i$ = mid-points.

:::remember
The step-deviation method only speeds up finding $\bar x$. The deviations $|x_i - \bar x|$ are still taken from the **actual** values, not from the $d_i$.
:::

:::trap
Classes like 16–20, 21–25, … have gaps. Before using the median formula, make them continuous: subtract 0.5 from each lower limit and add 0.5 to each upper limit (15.5–20.5, 20.5–25.5, …). The mid-points do not change, but $l$ does, and $h$ is 5, not 4.
:::

## 5. Limitations of mean deviation

- When the data varies a lot, the median is not a good representative, so M.D. about the median is not fully reliable.
- The sum of absolute deviations from the mean is never less than (usually more than) the sum from the median. NCERT uses this to say M.D. about the mean is "not very scientific".
- It uses absolute values, so it cannot be handled easily by algebra. That is why we need **standard deviation**.

## 6. Variance and standard deviation

- Another way to get rid of signs: **square** the deviations.
- The plain sum $\sum (x_i - \bar x)^2$ is not a fair measure: it grows with the number of observations. NCERT's example: 6 widely spread values give 1750, while 31 closely packed values give 2480.
- So we take the **mean** of the squared deviations. This is the **variance**:

$$\sigma^2 = \frac{1}{n}\sum (x_i - \bar x)^2$$

- Variance has the unit of the data **squared**. Its positive square root, $\sigma$, is the **standard deviation**. It has the same unit as the data.
- $\sigma^2 = 0$ only when every observation equals the mean (no spread at all).

:::example{title="Variance of single observations"}
Data: $1, 3, 5, 7, 9$. Mean $= 25/5 = 5$.

$(x_i - 5)^2$: $16, 4, 0, 4, 16$. Sum $= 40$.

$\sigma^2 = 40/5 = 8$, so $\sigma = 2\sqrt2 \approx 2.83$.
:::

## 7. Variance for frequency tables

- Discrete: $\sigma^2 = \dfrac{1}{N}\sum f_i (x_i - \bar x)^2$.
- Continuous: replace each class by its mid-point, then the same formula.
- Expanding the square gives a form with no deviations:

$$\sigma^2 = \frac{1}{N}\sum f_i x_i^2 - \bar x^{\,2}$$

- In words: variance = (mean of the squares) − (square of the mean).

## 8. Shortcut (step-deviation) method

- When the $x_i$ are large, put $y_i = \dfrac{x_i - A}{h}$. $A$ is an assumed mean near the middle, $h$ the class width.
- Then $\bar x = A + h\,\bar y$ and $\sigma_x = h\,\sigma_y$.
- Shifting the origin (subtracting $A$) does not change spread. Dividing by $h$ divides $\sigma$ by $h$, so we multiply back by $h$ at the end.

| Change to every $x_i$ | Mean | Variance | S.D. |
|---|---|---|---|
| add $b$ | $+b$ | same | same |
| multiply by $k$ | $\times k$ | $\times k^2$ | $\times \lvert k\rvert$ |

## 9. Typical exam tasks

- **Find missing observations.** From the mean, get $x + y$. From the variance, get $x^2 + y^2$. Then $2xy = (x + y)^2 - (x^2 + y^2)$ and $(x - y)^2 = x^2 + y^2 - 2xy$.
- **Correct a wrong reading.** Rebuild $\sum x_i = n\bar x$ and $\sum x_i^2 = n(\sigma^2 + \bar x^2)$, swap the wrong value for the right one in both, and recompute.
- **Compare two series** (beyond the syllabus: removed from NCERT and not named in the JEE Main 2026 syllabus, but seen in older papers): for positive means, the series with the smaller coefficient of variation $\dfrac{\sigma}{\bar x} \times 100$ is more consistent.

:::example{title="Correcting the mean and S.D."}
10 observations have mean 8 and S.D. 2. One value 9 was misread; it should be 19.

$\sum x = 80$ and $\sum x^2 = 10(4 + 64) = 680$.

Correct: $\sum x = 90$, so the mean is 9. $\sum x^2 = 680 - 81 + 361 = 960$.

$\sigma^2 = 96 - 81 = 15$, so $\sigma = \sqrt{15} \approx 3.87$.
:::
