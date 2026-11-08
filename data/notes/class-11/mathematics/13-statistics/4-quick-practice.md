---
title: "Statistics: Quick Practice"
type: practice
chapter: c11.mathematics.statistics
order: 4
---

Try each question first, then tap **Show answer**. Variance here is the NCERT kind (divide by $n$ or $N$).

## Mean deviation

:::question{title="1. About the mean" exam="JEE Main level"}
Find the mean deviation about the mean of $6, 9, 3, 12, 15, 21$.

---

Mean $= 66/6 = 11$. $|x_i - 11|$: $5, 2, 8, 1, 4, 10$, sum $30$.

M.D.$(\bar x) = 30/6 =$ **5**.
:::

:::question{title="2. About the median, discrete" exam="JEE Main level"}
Find the mean deviation about the median.

| $x_i$ | $f_i$ |
|---|---|
| 2 | 3 |
| 4 | 5 |
| 6 | 8 |
| 8 | 4 |
| 10 | 2 |

---

$N = 22$. c.f.: $3, 8, 16, 20, 22$. The 11th and 12th observations are both 6, so $M = 6$.

$\sum f_i|x_i - 6| = 3(4) + 5(2) + 8(0) + 4(2) + 2(4) = 38$.

M.D.$(M) = \dfrac{38}{22} = \dfrac{19}{11} \approx$ **1.73**.
:::

:::question{title="3. About the median, classes" exam="JEE Main level"}
Find the mean deviation about the median.

| Class | $f$ |
|---|---|
| 0–10 | 5 |
| 10–20 | 10 |
| 20–30 | 20 |
| 30–40 | 9 |
| 40–50 | 6 |

---

$N = 50$, c.f.: $5, 15, 35, 44, 50$. $N/2 = 25$, so the median class is 20–30, with $l = 20$, $C = 15$, $f = 20$, $h = 10$.

$M = 20 + \dfrac{25 - 15}{20} \times 10 = 25$.

Mid-points $5, 15, 25, 35, 45$; $|x_i - 25|$: $20, 10, 0, 10, 20$.

$\sum f_i|x_i - 25| = 100 + 100 + 0 + 90 + 120 = 410$, so M.D.$(M) = 410/50 =$ **8.2**.
:::

## Variance and standard deviation

:::question{title="4. Single observations" exam="JEE Main level"}
Find the variance of $3, 7, 8, 10, 12$.

---

Mean $= 40/5 = 8$. $(x_i - 8)^2$: $25, 1, 0, 4, 16$, sum $46$.

$\sigma^2 = 46/5 =$ **9.2**.
:::

:::question{title="5. Discrete table" exam="JEE Main level"}
Find the mean and standard deviation.

| $x_i$ | $f_i$ |
|---|---|
| 10 | 2 |
| 20 | 2 |
| 30 | 6 |
| 40 | 6 |
| 50 | 4 |

---

$N = 20$, $\sum f_i x_i = 20 + 40 + 180 + 240 + 200 = 680$, so $\bar x = 34$.

$x_i - 34$: $-24, -14, -4, 6, 16$. $\sum f_i(x_i - 34)^2 = 1152 + 392 + 96 + 216 + 1024 = 2880$.

$\sigma^2 = 2880/20 = 144$. Mean **34**, S.D. **12**.
:::

:::question{title="6. Shortcut method" exam="JEE Main level"}
Find the mean and variance.

| Class | $f$ |
|---|---|
| 0–10 | 2 |
| 10–20 | 5 |
| 20–30 | 9 |
| 30–40 | 4 |
| 40–50 | 5 |

---

Take $A = 25$, $h = 10$, $y_i = \dfrac{x_i - 25}{10}$: $-2, -1, 0, 1, 2$.

$\sum f_i y_i = -4 - 5 + 0 + 4 + 10 = 5$. $\sum f_i y_i^2 = 8 + 5 + 0 + 4 + 20 = 37$. $N = 25$.

$\bar x = 25 + 10 \times \dfrac{5}{25} = 27$.

$\sigma^2 = \dfrac{100}{625}\left[25(37) - 5^2\right] = \dfrac{100 \times 900}{625} = 144$.

Mean **27**, variance **144**.
:::

## Properties and harder ones

:::question{title="7. Change of origin and scale" exam="JEE Main level"}
Some observations have mean 10 and standard deviation 3. Each observation $x$ is replaced by $5 - 2x$. Find the new mean and variance.

---

New mean $= 5 - 2(10) = -15$. New S.D. $= |-2| \times 3 = 6$.

Mean **−15**, variance **36**.
:::

:::question{title="8. Two missing observations" exam="JEE Main level"}
Six observations have mean 7 and variance 16. Four of them are $2, 5, 7, 14$. Find the other two.

---

Sum $= 42$, so $x + y = 42 - 28 = 14$.

$\sum x_i^2 = 6(16 + 49) = 390$, and $4 + 25 + 49 + 196 = 274$, so $x^2 + y^2 = 116$.

$2xy = 14^2 - 116 = 80$, so $(x - y)^2 = 116 - 80 = 36$ and $x - y = \pm 6$.

The two observations are **4 and 10**.
:::

:::question{title="9. A misread value" exam="JEE Main level"}
The mean and standard deviation of 20 observations were found to be 30 and 4. Later it was found that one value was read as 35 instead of 15. Find the correct mean and standard deviation.

---

$\sum x = 600$, $\sum x^2 = 20(16 + 900) = 18320$.

Correct: $\sum x = 600 - 35 + 15 = 580$, so the mean is $29$.

$\sum x^2 = 18320 - 1225 + 225 = 17320$, so $\sigma^2 = 866 - 841 = 25$.

Mean **29**, S.D. **5**.
:::

:::question{title="10. Natural numbers" exam="JEE Main level"}
The variance of the first $n$ natural numbers is 10. Find $n$, and the mean of these numbers.

---

$\dfrac{n^2 - 1}{12} = 10$, so $n^2 = 121$ and $n = 11$ ($n$ must be positive).

Mean $= \dfrac{11 + 1}{2} = 6$. So **$n = 11$, mean 6**.
:::
