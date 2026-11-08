---
title: "Straight Lines: Short Notes"
type: short_notes
chapter: c11.mathematics.straight-lines
order: 2
---

## 1. Recap of coordinate geometry

- A point $(x, y)$: $x$ is its distance from the $y$-axis, $y$ its distance from the $x$-axis, each with a sign. $(6, -4)$ is 6 units right of the $y$-axis and 4 units below the $x$-axis.
- From earlier classes you need the **distance formula**, the **section formula** (internal division), the **mid-point** and the **area of a triangle**.
- If the area of $\triangle ABC$ comes out 0, then $A$, $B$, $C$ lie on one line (they are **collinear**).

:::example{title="Area of a triangle"}
Vertices $(4, 4)$, $(3, -2)$, $(-3, 16)$:
$\tfrac12\left|4(-2 - 16) + 3(16 - 4) + (-3)(4 + 2)\right| = \tfrac12\left|-54\right| = 27$ square units.
:::

## 2. Inclination and slope

- The **inclination** $\theta$ of a line is the angle it makes with the positive $x$-axis, measured **anticlockwise**. $0^\circ \le \theta < 180^\circ$. (NCERT prints $0^\circ \le \theta \le 180^\circ$, but $180^\circ$ gives the same line as $0^\circ$, so the usual range stops just below $180^\circ$.)
- The **slope** (gradient) is $m = \tan\theta$. It is not defined for a vertical line ($\theta = 90^\circ$).
- Through $(x_1, y_1)$ and $(x_2, y_2)$ with $x_1 \ne x_2$: $m = \dfrac{y_2 - y_1}{x_2 - x_1}$ (rise over run). The order of the points does not matter, as long as it is the same on top and bottom.

| Inclination | Slope | Line |
|---|---|---|
| $0^\circ$ | $0$ | horizontal |
| acute | positive | rises to the right |
| $90^\circ$ | not defined | vertical |
| obtuse | negative | falls to the right |

## 3. Parallel and perpendicular lines

- Two **non-vertical** lines are **parallel** exactly when their slopes are equal: $m_1 = m_2$.
- Two **non-vertical** lines are **perpendicular** exactly when $m_1 m_2 = -1$, that is $m_2 = -\dfrac{1}{m_1}$.
- Reason: perpendicular lines have inclinations that differ by $90^\circ$, and $\tan(\alpha + 90^\circ) = -\cot\alpha$.
- A horizontal and a vertical line are perpendicular too. Check that case by hand.

## 4. Angle between two lines

- Two crossing lines make two angles, $\theta$ and $180^\circ - \theta$. For two non-vertical lines with $1 + m_1 m_2 \ne 0$, the **acute** one is given by $\tan\theta = \left|\dfrac{m_2 - m_1}{1 + m_1 m_2}\right|$. If $1 + m_1 m_2 = 0$, the lines are perpendicular.
- Without the modulus, a positive value of $\dfrac{m_2 - m_1}{1 + m_1 m_2}$ gives the acute angle and a negative value gives the obtuse one.
- When you know the angle and one slope and want the other slope, the modulus gives **two** answers: one line on each side.

:::example{title="Two possible slopes (NCERT Example 2)"}
Angle $\dfrac{\pi}{4}$, one slope $\dfrac12$. Then $\dfrac{m - \frac12}{1 + \frac{m}{2}} = \pm 1$, so $m = 3$ or $m = -\dfrac13$.
:::

## 5. Collinear points

$A$, $B$, $C$ are collinear exactly when the slope of $AB$ equals the slope of $BC$ (they share the point $B$, so the lines are the same line). The area test (area $= 0$) also works, and it also works for vertical lines.

## 6. Forms of the equation of a line

A line's equation is a condition on $(x, y)$ that is true for every point on the line and false for every other point.

| You know | Use |
|---|---|
| a point and the slope | $y - y_0 = m(x - x_0)$ |
| two points | two-point form |
| slope and $y$-intercept $c$ | $y = mx + c$ |
| slope and $x$-intercept $d$ | $y = m(x - d)$ |
| both intercepts $a$, $b$ | $\dfrac{x}{a} + \dfrac{y}{b} = 1$ |

- Lines parallel to the axes: $y = a$ (horizontal) and $x = b$ (vertical). A vertical line has no slope, so it fits **only** the form $x = b$.
- An **intercept** is the signed coordinate where the line cuts an axis, not a distance. "Cuts the $x$-axis 3 units to the left of the origin" means $x$-intercept $= -3$.
- Any equation $Ax + By + C = 0$ with $A$ and $B$ not both zero is the **general equation** of a line. Every form above can be rearranged into it.

:::example{title="Intercept form (NCERT Example 8)"}
Intercepts $-3$ and $2$: $\dfrac{x}{-3} + \dfrac{y}{2} = 1$, that is $2x - 3y + 6 = 0$.
:::

## 7. Changing the general form

- **Slope-intercept:** for $B \ne 0$, $y = -\dfrac{A}{B}x - \dfrac{C}{B}$. So the slope is $-\dfrac{A}{B}$ and the $y$-intercept is $-\dfrac{C}{B}$.
- **Intercept form:** for $C \ne 0$ (and $A$, $B$ both non-zero, so the line cuts both axes), move $C$ to the right and divide by $-C$. Example: $3x + 2y - 12 = 0$ gives $\dfrac{x}{4} + \dfrac{y}{6} = 1$.
- A line through the origin ($C = 0$) has both intercepts 0, so it has no intercept form. A line parallel to an axis meets only one axis: $3y + 2 = 0$ has $y$-intercept $-\dfrac23$ and no $x$-intercept.
- A line parallel to $Ax + By + C = 0$ is $Ax + By + k = 0$ (same $A$, $B$). A line perpendicular to it is $Bx - Ay + k = 0$ (a shortcut that follows from $m_1 m_2 = -1$). Find $k$ from the given point.

## 8. Distance of a point from a line

- The distance of a point from a line is the length of the **perpendicular** from the point to the line.
- From $(x_1, y_1)$ to $Ax + By + C = 0$: $d = \dfrac{|Ax_1 + By_1 + C|}{\sqrt{A^2 + B^2}}$. NCERT proves it with the area of the triangle formed by the point and the two axis intercepts.
- Between parallel lines $Ax + By + C_1 = 0$ and $Ax + By + C_2 = 0$: $d = \dfrac{|C_1 - C_2|}{\sqrt{A^2 + B^2}}$. Make $A$ and $B$ **the same** in both equations first.

:::example{title="Distance from a line (NCERT Example 9)"}
$(3, -5)$ from $3x - 4y - 26 = 0$: $d = \dfrac{|9 + 20 - 26|}{\sqrt{9 + 16}} = \dfrac35$.
:::

## 9. Using the equations (NCERT miscellaneous examples)

- **Point of intersection:** solve the two equations together.
- **Concurrent lines** pass through one common point. Find where two of them meet, then put that point into the third.
- **Distance along a given line:** find where that line meets the target line, then use the distance formula. This is usually **longer** than the perpendicular distance.
- **Image in a line (mirror):** if $Q$ is the image of $P$, the line is the **perpendicular bisector** of $PQ$. So the slope of $PQ \times$ the slope of the line $= -1$, and the mid-point of $PQ$ lies on the line.
- **Locus:** let the moving point be $(h, k)$, write the condition, simplify, then replace $h, k$ by $x, y$. Points equidistant from two crossing lines lie on two lines (the angle bisectors).

:::example{title="Image of a point (NCERT Example 13)"}
Image of $(1, 2)$ in $x - 3y + 4 = 0$: slope condition $3h + k = 5$, mid-point condition $h - 3k = -3$. So the image is $\left(\dfrac65, \dfrac75\right)$.
:::

## 10. Exam extras (not in current NCERT)

These are not in the rationalised book. Normal form and distance form come under "various forms of the equation of a line" in the JEE Main syllabus; the others are shortcuts for work NCERT does by hand.

- **Normal form** $x\cos\omega + y\sin\omega = p$: $p$ is the perpendicular distance from the origin.
- **Distance form:** points at distance $r$ from $(x_1, y_1)$ along inclination $\theta$ are $(x_1 + r\cos\theta,\ y_1 + r\sin\theta)$. Quick for "distance along a line" questions.
- **Family of lines** $L_1 + \lambda L_2 = 0$: lines through the meeting point of $L_1 = 0$ and $L_2 = 0$, without solving for that point.
- **Same side test:** put both points into $Ax + By + C$. Same sign means the same side; opposite signs mean the line passes between them.
- **Triangle centres:** centroid $G$ (medians meet), circumcentre $O$ (perpendicular bisectors of the sides meet) and orthocentre $H$ (altitudes meet) are in the JEE Main syllabus. The incentre $I$ (angle bisectors meet) is not named there (beyond the syllabus). Beyond the syllabus but handy: $H$, $G$, $O$ lie on one line with $HG : GO = 2 : 1$.
