---
title: "Complex Numbers: Short Notes"
type: short_notes
chapter: c11.mathematics.complex-numbers-and-quadratic-equations
order: 2
---

:::remember
The current NCERT chapter (2023 onwards) covers complex numbers, their algebra, modulus, conjugate and the Argand plane. Solving quadratic equations, the polar form and the argument are **not** in the current text, but JEE Main still lists them. They are marked "exam extra" below. (Section 4.5 is titled "Argand Plane and Polar Representation", but it only covers the Argand plane.)
:::

## 1. Why complex numbers

- $x^2 + 1 = 0$ has no real solution, because the square of a real number is never negative.
- So we bring in $i = \sqrt{-1}$, with $i^2 = -1$. Now $i$ and $-i$ both solve $x^2 = -1$.
- The aim is to solve $ax^2 + bx + c = 0$ even when $D = b^2 - 4ac < 0$.

## 2. Complex numbers

- A **complex number** is $z = a + ib$ with $a, b$ real. NCERT also writes it as $a + bi$ or $2 + i3$.
- $a = \text{Re}\,z$ is the **real part**. $b = \text{Im}\,z$ is the **imaginary part**. Both are real numbers.
- $a + i0$ is a real number. $0 + ib$ with $b \ne 0$ is called purely imaginary.
- **Equality:** $a + ib = c + id$ exactly when $a = c$ and $b = d$. One equation between complex numbers gives **two** real equations.

:::example{title="Equating parts"}
If $4x + i(3x - y) = 3 - 6i$ with $x, y$ real, then $4x = 3$ and $3x - y = -6$. So $x = \dfrac34$ and $y = \dfrac{33}{4}$.
:::

## 3. Addition and subtraction

- $(a + ib) + (c + id) = (a + c) + i(b + d)$. Add real parts and imaginary parts separately.
- $z_1 - z_2 = z_1 + (-z_2)$, where $-z = -a + i(-b)$.
- Addition is **closed, commutative and associative**.
- **Additive identity:** $0 = 0 + i0$, with $z + 0 = z$.
- **Additive inverse:** $-z$, with $z + (-z) = 0$.

## 4. Multiplication

- $(a + ib)(c + id) = (ac - bd) + i(ad + bc)$. Just expand like brackets and put $i^2 = -1$.
- Multiplication is **closed, commutative and associative**, and it is **distributive** over addition.
- **Multiplicative identity:** $1 = 1 + i0$.
- **Multiplicative inverse:** every $z \ne 0$ has $z^{-1} = \dfrac{a - ib}{a^2 + b^2}$, with $z \cdot z^{-1} = 1$.

:::example{title="Inverse"}
For $z = 2 - 3i$: $z^{-1} = \dfrac{2 + 3i}{2^2 + 3^2} = \dfrac{2}{13} + \dfrac{3}{13}i$.
:::

## 5. Division

- $\dfrac{z_1}{z_2} = z_1 \cdot \dfrac{1}{z_2}$, for $z_2 \ne 0$.
- Working rule: multiply the top and the bottom by the **conjugate of the bottom**. The bottom becomes the real number $c^2 + d^2$.

:::example{title="Division"}
$\dfrac{6 + 3i}{2 - i} = \dfrac{(6 + 3i)(2 + i)}{(2 - i)(2 + i)} = \dfrac{12 + 6i + 6i - 3}{5} = \dfrac{9}{5} + \dfrac{12}{5}i$
:::

## 6. Powers of i

| Power | Value |
|---|---|
| $i^{4k}$ | $1$ |
| $i^{4k+1}$ | $i$ |
| $i^{4k+2}$ | $-1$ |
| $i^{4k+3}$ | $-i$ |

- This holds for **every integer** $k$, including negative ones.
- To find $i^n$: divide $n$ by 4 and use the remainder. Example: $i^{35} = i^{32} \cdot i^3 = -i$.
- Negative powers: $i^{-1} = \dfrac1i = -i$, $i^{-2} = -1$, $i^{-3} = i$, $i^{-4} = 1$.

## 7. Square roots of negative numbers

- $-1$ has two square roots, $i$ and $-i$. But the symbol $\sqrt{-1}$ means $i$ only.
- For $a > 0$: $\sqrt{-a} = \sqrt{a}\,i$. So $\sqrt{-3} = \sqrt3\,i$, and the square roots of $-3$ are $\pm\sqrt3\,i$.
- $\sqrt{a}\,\sqrt{b} = \sqrt{ab}$ when at least one of $a, b$ is non-negative.
- It **fails** when both are negative: $\sqrt{-1}\,\sqrt{-1} = i^2 = -1$, not $\sqrt{1} = 1$.

## 8. Identities

- All the usual algebraic identities still hold for complex numbers, because the same laws (commutative, associative, distributive) hold.
- So $(z_1 + z_2)^2$, $(z_1 - z_2)^2$, $(z_1 \pm z_2)^3$ and $z_1^2 - z_2^2$ expand exactly as for real numbers.

:::example{title="A cube"}
$(5 - 3i)^3 = 125 - 3(25)(3i) + 3(5)(3i)^2 - (3i)^3 = 125 - 225i - 135 + 27i = -10 - 198i$
:::

## 9. Modulus and conjugate

- **Modulus:** $|a + ib| = \sqrt{a^2 + b^2}$, a non-negative real number. Example: $|2 - 5i| = \sqrt{29}$.
- **Conjugate:** $\overline{a + ib} = a - ib$. Change the sign of the imaginary part only. Example: $\overline{-3i - 5} = 3i - 5$.
- $z\bar z = a^2 + b^2 = |z|^2$, so $z^{-1} = \dfrac{\bar z}{|z|^2}$.
- Modulus splits over products and quotients: $|z_1 z_2| = |z_1||z_2|$ and $\left|\dfrac{z_1}{z_2}\right| = \dfrac{|z_1|}{|z_2|}$.
- Conjugate splits over all four operations: $\overline{z_1 \pm z_2}$, $\overline{z_1 z_2}$ and $\overline{z_1 / z_2}$.
- $z$ is real exactly when $z = \bar z$. $\text{Re}\,z = 0$ exactly when $z + \bar z = 0$.

## 10. Argand plane

- $z = x + iy$ is drawn as the point $P(x, y)$. The plane is the **complex plane** or **Argand plane**.
- The x-axis is the **real axis** (numbers $a + i0$). The y-axis is the **imaginary axis** (numbers $0 + ib$).
- $|z|$ is the distance $OP$ from the origin.
- $\bar z = x - iy$ is the point $Q(x, -y)$, the **mirror image** of $P$ in the real axis.
- (Exam extra) $|z_1 - z_2|$ is the distance between the points $z_1$ and $z_2$. So $|z - z_0| = r$ (with $r > 0$) is a circle with centre $z_0$ and radius $r$.

## 11. Argument and polar form (exam extra)

- For $z = a + ib \ne 0$, let $r = |z|$ and $\theta$ be the angle $OP$ makes with the positive real axis.
- Then $a = r\cos\theta$ and $b = r\sin\theta$, so $z = r(\cos\theta + i\sin\theta)$.
- $\theta$ is the **argument**. We use the **principal argument**, $-\pi < \theta \le \pi$. (Some books use $0 \le \theta < 2\pi$; the older NCERT book and JEE questions use $(-\pi, \pi]$.)
- Find the acute angle $\alpha$ with $\tan\alpha = \left|\dfrac{b}{a}\right|$, then fix the quadrant:

| Quadrant | $a, b$ | $\arg z$ |
|---|---|---|
| I | $+, +$ | $\alpha$ |
| II | $-, +$ | $\pi - \alpha$ |
| III | $-, -$ | $-(\pi - \alpha)$ |
| IV | $+, -$ | $-\alpha$ |

- On the axes: positive real axis $0$, negative real axis $\pi$, positive imaginary axis $\dfrac{\pi}{2}$, negative imaginary axis $-\dfrac{\pi}{2}$.

- Multiplying multiplies the moduli and adds the arguments. Dividing divides the moduli and subtracts the arguments. Add or subtract $2\pi$ if needed to stay in $(-\pi, \pi]$.

## 12. Quadratic equations (exam extra)

- For $ax^2 + bx + c = 0$ with $a, b, c$ real and $a \ne 0$, the roots are $\dfrac{-b \pm \sqrt{D}}{2a}$ with $D = b^2 - 4ac$.

| $D$ | Roots |
|---|---|
| $D > 0$ | Two different real roots |
| $D = 0$ | Two equal real roots |
| $D < 0$ | Two non-real roots, conjugates of each other |

- Sum of roots $= -\dfrac{b}{a}$, product $= \dfrac{c}{a}$. These hold for complex roots too.
- With roots $\alpha, \beta$: the equation is $x^2 - (\alpha + \beta)x + \alpha\beta = 0$.
- A polynomial equation of degree $n$ has $n$ roots (counting repeats) among the complex numbers.

:::example{title="D less than 0"}
$x^2 - 2x + 5 = 0$: $D = 4 - 20 = -16$, so $x = \dfrac{2 \pm 4i}{2} = 1 \pm 2i$.
:::

## 13. Cube roots of unity (exam extra)

- $x^3 = 1$ gives $(x - 1)(x^2 + x + 1) = 0$. The roots are $1$, $\omega = \dfrac{-1 + i\sqrt3}{2}$ and $\omega^2 = \dfrac{-1 - i\sqrt3}{2}$.
- $\omega^3 = 1$ and $1 + \omega + \omega^2 = 0$. Also $\bar\omega = \omega^2 = \dfrac1\omega$.
