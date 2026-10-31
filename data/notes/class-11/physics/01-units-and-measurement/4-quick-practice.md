---
title: "Units and Measurement: Quick Practice"
type: practice
chapter: c11.physics.units-and-measurement
order: 4
---

Try each question first, then tap **Show answer**. Take $g = 10$ m/s² unless the question says otherwise. (No question here needs $g$.)

## Significant figures

:::question{title="1. Counting significant figures" exam="NEET level"}
Using NCERT's rules, how many significant figures are there in (a) 0.007050 kg and (b) 7050 m?

---

(a) The leading zeros don't count; the zero between 7 and 5 counts; the trailing zero after a decimal point counts. Digits 7, 0, 5, 0: **4**.

(b) No decimal point, so the trailing zero doesn't count. Digits 7, 0, 5: **3**.
:::

:::question{title="2. Area of a plate" exam="NEET level"}
A rectangular plate measures 4.215 cm by 3.0 cm. Write its area with the correct number of significant figures.

---

$4.215 \times 3.0 = 12.645$ cm². In a product, keep the least number of significant figures, which is 2 (from 3.0). Area $=$ **13 cm²**.
:::

:::question{title="3. Rounding a 5" exam="JEE Main level"}
Round each to 3 significant figures using NCERT's rule: (a) 6.835 (b) 6.825.

---

The dropped digit is exactly 5 in both.

(a) The digit before it, 3, is odd, so raise it: **6.84**.

(b) The digit before it, 2, is even, so leave it: **6.82**.
:::

## Dimensions

:::question{title="4. Van der Waals constants" exam="JEE Main level"}
In the equation $\left(P + \dfrac{a}{V^2}\right)(V - b) = RT$, $P$ is pressure and $V$ is volume. Find the dimensions of $a$, $b$ and $a/b$.

---

$b$ is subtracted from $V$, so **$[b] = [\mathrm{L^3}]$**.

$a/V^2$ is added to $P$, so $[a] = [P][V^2] = [\mathrm{ML^{-1}T^{-2}}][\mathrm{L^6}]$, which gives **$[a] = [\mathrm{ML^5T^{-2}}]$**.

$[a/b] = [\mathrm{ML^2T^{-2}}]$, the dimensions of **energy**.
:::

:::question{title="5. Spring period" exam="NEET level"}
The period $T$ of a mass $m$ on a spring of spring constant $k$ (force per unit extension) depends only on $m$ and $k$. Use dimensions to find how.

---

Let $T = C\,m^x k^y$, with $[k] = [\mathrm{MT^{-2}}]$.

$[\mathrm{T}] = [\mathrm{M}]^x[\mathrm{MT^{-2}}]^y$, so M: $x + y = 0$ and T: $-2y = 1$.

$y = -\tfrac12$, $x = \tfrac12$, so **$T = C\sqrt{m/k}$**. (Theory gives $C = 2\pi$.)
:::

:::question{title="6. A length from constants" exam="JEE Main level"}
A length is built as $l = h^x G^y c^z$, where $h$ is Planck's constant, $G$ the gravitational constant and $c$ the speed of light. Find $x$, $y$, $z$.

---

$[h] = [\mathrm{ML^2T^{-1}}]$, $[G] = [\mathrm{M^{-1}L^3T^{-2}}]$, $[c] = [\mathrm{LT^{-1}}]$.

M: $x - y = 0$. L: $2x + 3y + z = 1$. T: $-x - 2y - z = 0$.

With $y = x$: $5x + z = 1$ and $z = -3x$, so $2x = 1$.

**$x = \tfrac12$, $y = \tfrac12$, $z = -\tfrac32$**, giving $l = \sqrt{hG/c^3}$.
:::

:::question{title="7. A new system of units" exam="JEE Main level"}
In a new system, the unit of mass is 2 kg, the unit of length is 2 m and the unit of time is 2 s. What is 40 J in this system?

---

The new unit of energy is $\dfrac{(2\text{ kg})(2\text{ m})^2}{(2\text{ s})^2} = 2$ J.

So $40\text{ J} = \dfrac{40}{2} =$ **20 new units**.
:::

## Errors and least count (exam extra, except the product rule)

:::question{title="8. Percentage error" exam="NEET level"}
$Z = \dfrac{A^2 B}{\sqrt C}$. The percentage errors in $A$, $B$ and $C$ are 1%, 2% and 4%. Find the maximum percentage error in $Z$.

---

$\dfrac{\Delta Z}{Z} = 2(1\%) + 1(2\%) + \tfrac12(4\%) = 2 + 2 + 2 =$ **6%**.
:::

:::question{title="9. Pendulum experiment" exam="JEE Main level"}
In a pendulum experiment, $g = \dfrac{4\pi^2 l}{T^2}$. The length is measured as 100.0 cm with a scale of least count 0.1 cm. The time for 20 oscillations is 40.0 s, measured with a stopwatch of least count 0.1 s. Taking each least count as the error, find the maximum percentage error in $g$.

---

Error in $l$: $\dfrac{0.1}{100.0} \times 100 = 0.1\%$.

$T = t/20$, so $\dfrac{\Delta T}{T} = \dfrac{\Delta t}{t} = \dfrac{0.1}{40.0} \times 100 = 0.25\%$.

$\dfrac{\Delta g}{g} = 0.1\% + 2(0.25\%) =$ **0.6%**.
:::

:::question{title="10. Vernier with zero error" exam="NEET level"}
In a vernier callipers, 10 vernier divisions equal 9 main-scale divisions, and 1 main-scale division is 1 mm. With the jaws closed, the vernier zero is to the right of the main-scale zero and the 2nd vernier division coincides. Measuring a rod, the main-scale reading is 2.3 cm and the 4th vernier division coincides. Find the length of the rod.

---

LC $= 1\text{ mm} - 0.9\text{ mm} = 0.1$ mm $= 0.01$ cm.

Zero error $= +2 \times 0.01 = +0.02$ cm (positive, since the vernier zero is to the right).

Reading $= 2.3 + 4 \times 0.01 = 2.34$ cm.

Length $= 2.34 - 0.02 =$ **2.32 cm**.
:::
