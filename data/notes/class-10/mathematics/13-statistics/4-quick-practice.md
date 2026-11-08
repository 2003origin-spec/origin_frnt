---
title: "Statistics: Quick Practice"
type: practice
chapter: c10.mathematics.statistics
order: 4
---

Try each question first, then tap **Show answer**.

## Mean

:::question{title="1. Direct method" exam="Board level"}
Find the mean of this data.

| Class | Frequency |
|---|---|
| 0–10 | 4 |
| 10–20 | 6 |
| 20–30 | 8 |
| 30–40 | 7 |
| 40–50 | 5 |

---

Class marks: 5, 15, 25, 35, 45. $\Sigma f_i = 30$.

$\Sigma f_i x_i = 20 + 90 + 200 + 245 + 225 = 780$.

$\bar{x} = \dfrac{780}{30} =$ **26**.
:::

:::question{title="2. Step-deviation" exam="Board level"}
The daily wages (in ₹) of 50 workers are given. Find the mean daily wage.

| Wage (₹) | Workers |
|---|---|
| 500–600 | 6 |
| 600–700 | 10 |
| 700–800 | 14 |
| 800–900 | 12 |
| 900–1000 | 8 |

---

Class marks 550, ..., 950. Take $a = 750$, $h = 100$. Then $u_i = -2, -1, 0, 1, 2$.

$\Sigma f_i u_i = -12 - 10 + 0 + 12 + 16 = 6$.

$\bar{x} = 750 + 100 \times \dfrac{6}{50} = 750 + 12 =$ **₹ 762**.
:::

:::question{title="3. Missing frequency" exam="Board level"}
The mean of this data is 54. Find $p$.

| Class | Frequency |
|---|---|
| 0–20 | 5 |
| 20–40 | 8 |
| 40–60 | $p$ |
| 60–80 | 12 |
| 80–100 | 7 |

---

Class marks: 10, 30, 50, 70, 90. $\Sigma f_i = 32 + p$.

$\Sigma f_i x_i = 50 + 240 + 50p + 840 + 630 = 1760 + 50p$.

$\dfrac{1760 + 50p}{32 + p} = 54$ gives $1760 + 50p = 1728 + 54p$, so $4p = 32$ and $p =$ **8**.
:::

:::question{title="4. Unequal classes" exam="Board level"}
Find the mean of this data.

| Class | Frequency |
|---|---|
| 10–20 | 4 |
| 20–30 | 6 |
| 30–50 | 10 |
| 50–70 | 6 |
| 70–80 | 4 |

---

Class marks: 15, 25, 40, 60, 75. Take $a = 40$. Then $d_i = -25, -15, 0, 20, 35$.

All $d_i$ are multiples of 5, so take $h = 5$: $u_i = -5, -3, 0, 4, 7$.

$\Sigma f_i u_i = -20 - 18 + 0 + 24 + 28 = 14$, and $\Sigma f_i = 30$.

$\bar{x} = 40 + 5 \times \dfrac{14}{30} = 40 + \dfrac{7}{3} \approx$ **42.33**.
:::

## Mode

:::question{title="5. Mode" exam="Board level"}
Find the mode of this data.

| Class | Frequency |
|---|---|
| 0–10 | 4 |
| 10–20 | 10 |
| 20–30 | 16 |
| 30–40 | 12 |
| 40–50 | 6 |

---

Modal class 20 – 30. $l = 20$, $h = 10$, $f_1 = 16$, $f_0 = 10$, $f_2 = 12$.

Mode $= 20 + \dfrac{16 - 10}{32 - 10 - 12} \times 10 = 20 + \dfrac{6}{10} \times 10 =$ **26**.
:::

:::question{title="6. Empirical relation" exam="Board level"}
For a data set, the median is 24 and the mean is 25.5. Use the empirical relationship to estimate the mode.

---

$3\,\text{Median} = \text{Mode} + 2\,\text{Mean}$, so Mode $= 3(24) - 2(25.5) = 72 - 51 =$ **21**.
:::

## Median

:::question{title="7. Median" exam="Board level"}
Find the median of this data.

| Class | Frequency |
|---|---|
| 0–10 | 5 |
| 10–20 | 10 |
| 20–30 | 20 |
| 30–40 | 8 |
| 40–50 | 7 |

---

cf: 5, 15, 35, 43, 50. $n = 50$, so $\dfrac{n}{2} = 25$. The median class is 20 – 30.

$l = 20$, $cf = 15$, $f = 20$, $h = 10$.

Median $= 20 + \dfrac{25 - 15}{20} \times 10 =$ **25**.
:::

:::question{title="8. Less than type" exam="Board level"}
Marks of 40 students: less than 10: 5, less than 20: 12, less than 30: 27, less than 40: 36, less than 50: 40. Find the median marks.

---

Class frequencies (0–10, ..., 40–50): 5, 7, 15, 9, 4.

$\dfrac{n}{2} = 20$. The first cf above 20 is 27, so the median class is 20 – 30.

$l = 20$, $cf = 12$, $f = 15$, $h = 10$.

Median $= 20 + \dfrac{20 - 12}{15} \times 10 = 20 + \dfrac{16}{3} \approx$ **25.33**.
:::

:::question{title="9. Two unknowns" exam="Board level"}
The total frequency is 50 and the median is 35. Find $x$ and $y$.

| Class | Frequency |
|---|---|
| 0–10 | 4 |
| 10–20 | $x$ |
| 20–30 | 10 |
| 30–40 | 12 |
| 40–50 | $y$ |
| 50–60 | 6 |

---

Total: $32 + x + y = 50$, so $x + y = 18$.

Median 35 lies in 30 – 40. So $l = 30$, $f = 12$, $h = 10$, and $cf = 4 + x + 10 = 14 + x$.

$35 = 30 + \dfrac{25 - (14 + x)}{12} \times 10$ gives $60 = 110 - 10x$, so $x = 5$.

Then $y = 18 - 5 = 13$. **$x = 5$, $y = 13$.**
:::

:::question{title="10. Non-continuous classes" exam="Board level"}
Find the median length (in mm) of 40 leaves.

| Length (mm) | Leaves |
|---|---|
| 10–19 | 3 |
| 20–29 | 7 |
| 30–39 | 12 |
| 40–49 | 10 |
| 50–59 | 8 |

---

Make the classes continuous: 9.5–19.5, 19.5–29.5, 29.5–39.5, and so on. $h = 10$.

cf: 3, 10, 22, 32, 40. $\dfrac{n}{2} = 20$, so the median class is 29.5 – 39.5.

$l = 29.5$, $cf = 10$, $f = 12$.

Median $= 29.5 + \dfrac{20 - 10}{12} \times 10 = 29.5 + 8.33 \approx$ **37.83 mm**.
:::
