---
title: "Statistics: Short Notes"
type: short_notes
chapter: c10.mathematics.statistics
order: 2
---

## 1. What this chapter does

- In Class 9 you found the **mean, median and mode** of ungrouped data. These three are called **measures of central tendency**.
- This chapter finds the same three for **grouped data**, where the values are put into classes such as 10 – 20, 20 – 30.
- On the way, it uses **cumulative frequency**.

:::remember
**Class rule:** a value equal to an upper class limit goes into the **next** class. So 40 goes into 40 – 55, not 25 – 40.
:::

## 2. Mean of ungrouped data with frequencies

- If $x_1, x_2, \dots, x_n$ occur $f_1, f_2, \dots, f_n$ times, then
$$\bar{x} = \frac{\Sigma f_i x_i}{\Sigma f_i}$$
- Make a table with columns $x_i$, $f_i$ and $f_i x_i$. Add the last two columns, then divide.

## 3. Mean of grouped data

- We do not know the exact values inside a class. So we **assume** the values of each class are centred at its **mid-point (class mark)**.
- The class mark $x_i$ then stands for the whole class.
- Because of this assumption, the mean of grouped data is only **approximate**. NCERT's marks example gives 59.3 from the raw data but 62 after grouping.

### Three methods

| Method | New column | Use it when |
|---|---|---|
| Direct | $f_i x_i$ | $x_i$ and $f_i$ are small |
| Assumed mean | $d_i = x_i - a$ | $x_i$ are large |
| Step-deviation | $u_i = d_i / h$ | all $d_i$ share a factor $h$ |

The formulas are on the Formula Sheet. All three give the **same** answer.

- **Assumed mean $a$:** pick one of the class marks, usually one near the middle. Then the $d_i$ are small, and one of them is 0.
- **Step size $h$:** usually the class size. If the class sizes are unequal, take $h$ as a number that divides every $d_i$.

:::example{title="One table, three methods"}
Classes 0 – 10, 10 – 20, 20 – 30, 30 – 40 with frequencies 3, 5, 8, 4 ($n = 20$). Class marks: 5, 15, 25, 35.

**Direct:** $\Sigma f_i x_i = 15 + 75 + 200 + 140 = 430$, so $\bar{x} = \dfrac{430}{20} = 21.5$.

**Assumed mean** ($a = 25$): $d_i = -20, -10, 0, 10$. $\Sigma f_i d_i = -60 - 50 + 0 + 40 = -70$. So $\bar{x} = 25 + \dfrac{-70}{20} = 21.5$.

**Step-deviation** ($h = 10$): $u_i = -2, -1, 0, 1$. $\Sigma f_i u_i = -7$. So $\bar{x} = 25 + 10 \times \dfrac{-7}{20} = 21.5$.
:::

## 4. Mode of grouped data

- The **mode** is the value that occurs most often.
- In grouped data, we cannot see the mode from the table. We can only find the **modal class**: the class with the **highest frequency**.
- The mode is a value **inside** the modal class. Find it with the mode formula (Formula Sheet), which uses $l$, $h$, $f_1$, $f_0$ and $f_2$.
- The book uses the formula only when all classes have the **same size**.

:::example{title="Mode"}
Same table: frequencies 3, 5, **8**, 4. Modal class 20 – 30.

$l = 20$, $h = 10$, $f_1 = 8$, $f_0 = 5$, $f_2 = 4$.

Mode $= 20 + \dfrac{8 - 5}{16 - 5 - 4} \times 10 = 20 + \dfrac{30}{7} \approx 24.29$
:::

- Data can have more than one mode (**multimodal**). This chapter only takes data with one mode.

## 5. Cumulative frequency

- The **cumulative frequency (cf)** of a class is the frequency of that class plus the frequencies of **all the classes before it**. It is a running total.
- The last cumulative frequency is always $n$, the total.

| Type | Counts | Uses which limit |
|---|---|---|
| Less than | values below 10, below 20, ... | **upper** limits |
| More than or equal to | values from 0, from 10, ... | **lower** limits |

- **Less than type:** keep adding frequencies from the top.
- **More than or equal to type:** start from $n$ and keep subtracting frequencies.
- Going back: if "less than 145" is 11 and "less than 140" is 4, then the class 140 – 145 has frequency $11 - 4 = 7$.

## 6. Median of grouped data

- The **median** is the middle value. About half the data lies below it and half above it.
- Steps:
  1. Make a cumulative frequency column. Find $n$ and $\dfrac{n}{2}$.
  2. The **median class** is the first class whose cf is **greater than** $\dfrac{n}{2}$ (and nearest to it).
  3. Read $l$, $f$, $h$ from the median class, and $cf$ from the class **before** it.
  4. Put the values in the median formula.

:::example{title="Median"}
Same table: cf = 3, 8, 16, 20. $n = 20$, so $\dfrac{n}{2} = 10$.

The first cf above 10 is 16, so the median class is 20 – 30.

$l = 20$, $cf = 8$, $f = 8$, $h = 10$.

Median $= 20 + \dfrac{10 - 8}{8} \times 10 = 22.5$
:::

### Classes that are not continuous

- The mode and median formulas need **continuous** classes (no gaps).
- For 118 – 126, 127 – 135, ..., the gap is 1. Take half of it (0.5) off each lower limit and add it to each upper limit.
- The classes become 117.5 – 126.5, 126.5 – 135.5, and so on. Now $l$ and $h$ come from these new classes.

## 7. Ungrouped median (Class 9 recap)

- Arrange the values in ascending order.
- $n$ odd: the median is the $\left(\dfrac{n + 1}{2}\right)$th value.
- $n$ even: the median is the average of the $\left(\dfrac{n}{2}\right)$th and $\left(\dfrac{n}{2} + 1\right)$th values.
- With a frequency table, use a cumulative frequency column to find which value is in that position.

## 8. Which measure to use?

| Measure | Best for | Weak point |
|---|---|---|
| Mean | comparing groups (school averages) | pulled by extreme values |
| Median | a "typical" value, e.g. wages | does not use every value |
| Mode | the most popular item | may not be unique |

- The mean uses **every** observation and lies between the smallest and largest values.
- When the data has extreme values, the median is a better guide than the mean.
- The mode answers "which is most common?", such as the most watched TV show or the most liked colour.

:::remember
**Empirical relationship:** $3\,\text{Median} = \text{Mode} + 2\,\text{Mean}$ (approximate).

For the table above: $3 \times 22.5 = 67.5$, and $24.29 + 2 \times 21.5 = 67.29$. Close, but not exact.
:::
