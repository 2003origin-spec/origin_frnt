---
title: "Application of Integrals: Formula Sheet"
type: formula_sheet
chapter: c12.mathematics.application-of-integrals
order: 1
---

All areas are in square units. Sketch the region first, every time.

## Area under a curve

:::formula{title="Vertical strips (with the x-axis)"}
$$A = \int_a^b y\,dx = \int_a^b f(x)\,dx$$
Area between the curve $y = f(x)$, the x-axis and the lines $x = a$, $x = b$ ($b > a$).

As written, this needs $f(x) \ge 0$ on $[a, b]$ (curve above the x-axis). Each thin strip has area $dA = y\,dx$.
:::

:::formula{title="Horizontal strips (with the y-axis)"}
$$A = \int_c^d x\,dy = \int_c^d g(y)\,dy$$
Area between the curve $x = g(y)$, the y-axis and the lines $y = c$, $y = d$ ($d > c$).

As written, this needs $g(y) \ge 0$ on $[c, d]$ (curve to the right of the y-axis). Each strip has area $dA = x\,dy$.
:::

:::formula{title="Curve below the x-axis"}
If $f(x) \le 0$ on $[a, b]$, the integral comes out negative. The area is its size:
$$A = \left|\int_a^b f(x)\,dx\right|$$
:::

:::formula{title="Curve crossing the x-axis"}
If the curve is below the axis on $[a, c]$ and above it on $[c, b]$:
$$A_1 = \int_a^c f(x)\,dx < 0$$
$$A_2 = \int_c^b f(x)\,dx > 0$$
$$A = |A_1| + A_2$$
In general, split at every point where $f(x) = 0$, or use
$$A = \int_a^b |f(x)|\,dx$$
:::

## Circle and ellipse (NCERT examples)

:::formula{title="Integral used for both"}
$$\int_0^a \sqrt{a^2 - x^2}\,dx = \frac{\pi a^2}{4}$$
From the Chapter 7 formula (for $a > 0$):
$$\begin{aligned} \int \sqrt{a^2 - x^2}\,dx &= \frac{x}{2}\sqrt{a^2 - x^2} \\ &\quad + \frac{a^2}{2}\sin^{-1}\frac{x}{a} + C \end{aligned}$$
:::

:::formula{title="Area of a circle"}
$$x^2 + y^2 = a^2$$
$$A = 4\int_0^a \sqrt{a^2 - x^2}\,dx = \pi a^2$$
Radius $a > 0$. The factor 4 comes from symmetry about both axes.
:::

:::formula{title="Area of an ellipse"}
$$\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1$$
$$A = 4\cdot\frac{b}{a}\int_0^a \sqrt{a^2 - x^2}\,dx = \pi a b$$
$a, b > 0$ are the semi-axes. It works whichever axis is longer. If $a = b$, it becomes the circle $\pi a^2$.
:::

## Useful values

:::formula{title="Sine and cosine arches"}
$$\int_0^{\pi} \sin x\,dx = 2$$
One arch of $\sin x$ or $\cos x$ (between two neighbouring zeros) has area 2. Over a full period $2\pi$, the **integral** is 0 but the **area** is 4.
:::

## Exam extras: area between two curves

Not in the current NCERT chapter: its examples and exercises only find the area between one curve and an axis (the old section on area between two curves was removed). The JEE Main syllabus asks for "areas of the regions bounded by simple curves in standard forms", which includes regions between two curves, and these are tested often.

:::formula{title="Vertical strips: top minus bottom"}
$$A = \int_a^b \left[f(x) - g(x)\right] dx$$
Needs $f(x) \ge g(x)$ on all of $[a, b]$. Usually $a$ and $b$ are the $x$-values where the curves meet.
:::

:::formula{title="Horizontal strips: right minus left"}
$$A = \int_c^d \left[x_R(y) - x_L(y)\right] dy$$
$x_R$ = right curve, $x_L$ = left curve, both written as $x$ in terms of $y$. Needs $x_R(y) \ge x_L(y)$ on all of $[c, d]$.
:::

:::formula{title="Curves that cross"}
$$A = \int_a^b |f(x) - g(x)|\,dx$$
In practice: split at each crossing and take top minus bottom on each piece.
:::

## Ready results (exam extra shortcuts)

Not in NCERT, and the JEE Main syllabus does not list them by name: they are worked-out answers for common exam-extra regions. Check that the question matches the exact form and conditions, use them to check answers, and derive them in a written (board) exam.

:::formula{title="Parabola and a line through its vertex"}
$$y^2 = 4ax \text{ and } y = mx$$
$$A = \frac{8a^2}{3m^3}$$
For $a > 0$, $m > 0$. Example: $y^2 = x$ ($a = \frac14$) and $y = x$ ($m = 1$) enclose $\dfrac16$.
:::

:::formula{title="Parabola and its latus rectum"}
$$y^2 = 4ax \text{ and } x = a$$
$$A = \frac{8a^2}{3}$$
For $a > 0$. This is $\dfrac23$ of the rectangle around it ($a \times 4a$).
:::

:::formula{title="Two parabolas"}
$$y^2 = 4ax \text{ and } x^2 = 4by$$
$$A = \frac{16ab}{3}$$
For $a, b > 0$. With $a = b$ it is $\dfrac{16a^2}{3}$.
:::

:::formula{title="The square |x| + |y| ≤ a"}
$$A = 2a^2$$
For $a > 0$. A square with diagonals $2a$. No integration needed.
:::
