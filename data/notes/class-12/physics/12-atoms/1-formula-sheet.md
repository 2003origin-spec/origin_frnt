---
title: "Atoms (Physics): Formula Sheet"
type: formula_sheet
chapter: c12.physics.atoms
order: 1
---

Values NCERT uses in this chapter: $\dfrac{1}{4\pi\varepsilon_0} = 9 \times 10^9$ N m²/C², $e = 1.6 \times 10^{-19}$ C, $m = 9.1 \times 10^{-31}$ kg, $h = 6.6 \times 10^{-34}$ J s, 1 eV $= 1.6 \times 10^{-19}$ J.

## Alpha-particle scattering

:::formula{title="Force on the α-particle"}
$$F = \frac{1}{4\pi\varepsilon_0}\,\frac{(2e)(Ze)}{r^2}$$
$r$ = distance between the α-particle and the nucleus (m), $Ze$ = charge of the nucleus ($Z = 79$ for gold). A repulsive force along the line joining them.
:::

:::formula{title="Distance of closest approach (head-on)"}
$$d = \frac{2Ze^2}{4\pi\varepsilon_0 K}$$
$K$ = kinetic energy of the α-particle far away (J). At $d$ the α-particle stops for a moment, so all of $K$ has become potential energy. The nucleus is taken as fixed (gold is about 50 times heavier than an α-particle). From NCERT Example 12.2.

$d \propto \dfrac{Z \times (\text{charge of the projectile})}{K}$. The nucleus is **smaller** than $d$.
:::

:::formula{title="Impact parameter (exam extra, not in NCERT)"}
$$b = \frac{Ze^2\cot(\theta/2)}{4\pi\varepsilon_0 K}$$
$$b = \frac{d}{2}\cot\frac{\theta}{2}$$
$b$ = perpendicular distance of the initial velocity line from the centre of the nucleus, $\theta$ = scattering angle, $d$ = closest approach above. $b = 0$ gives $\theta = 180^\circ$ (head-on); large $b$ gives $\theta \approx 0$. Current NCERT only states this trend.
:::

:::formula{title="Number scattered at angle θ (exam extra, not in NCERT)"}
$$N(\theta) \propto \frac{1}{\sin^4(\theta/2)}$$
For a fixed beam, foil and detector size. Falls very fast as $\theta$ grows.
:::

:::tip
Handy number (beyond the syllabus, follows from NCERT values): $\dfrac{e^2}{4\pi\varepsilon_0} = 1.44$ MeV fm, where 1 fm $= 10^{-15}$ m. Then $d = \dfrac{2Z \times 1.44}{K(\text{MeV})}$ fm.
:::

## Electron in a circular orbit (Rutherford picture)

:::formula{title="Electric force gives the centripetal force"}
$$\frac{1}{4\pi\varepsilon_0}\,\frac{e^2}{r^2} = \frac{mv^2}{r}$$
$$r = \frac{e^2}{4\pi\varepsilon_0\, m v^2}$$
For the hydrogen atom (one electron, one proton).
:::

:::formula{title="Energies in the orbit"}
$$K = \frac{e^2}{8\pi\varepsilon_0 r}$$
$$U = -\frac{e^2}{4\pi\varepsilon_0 r}$$
$$E = K + U = -\frac{e^2}{8\pi\varepsilon_0 r}$$
$U$ is zero when the electron is infinitely far away. $E < 0$ means the electron is bound.
:::

## Bohr model of hydrogen

:::formula{title="Postulate 2: angular momentum"}
$$L = mvr = \frac{nh}{2\pi}$$
$n = 1, 2, 3, \dots$ = principal quantum number, $h$ = Planck's constant (J s).
:::

:::formula{title="Postulate 3: photon energy"}
$$h\nu = E_i - E_f$$
For emission: $E_i$ = energy of the initial (higher) state, $E_f$ = energy of the final (lower) state, $\nu$ = frequency of the photon (Hz). For absorption the atom starts in the lower state: $E_i + h\nu = E_f$.
:::

:::formula{title="Radius of the nth orbit"}
$$r_n = \frac{n^2 h^2 \varepsilon_0}{\pi m e^2}$$
$$r_n = n^2 a_0$$
Bohr radius $a_0 = r_1 = 5.3 \times 10^{-11}$ m $= 0.53$ Å. So $r_n \propto n^2$.
:::

:::formula{title="Energy of the nth state"}
$$E_n = -\frac{me^4}{8n^2\varepsilon_0^2 h^2}$$
$$E_n = -\frac{13.6}{n^2}\ \text{eV}$$
$$E_n = -\frac{2.18 \times 10^{-18}}{n^2}\ \text{J}$$
So $E_n \propto -\dfrac{1}{n^2}$. The zero of energy is the electron at rest, infinitely far away.
:::

:::formula{title="Kinetic and potential energy in a Bohr orbit"}
$$K_n = -E_n$$
$$U_n = 2E_n$$
Ground state: $K = 13.6$ eV, $U = -27.2$ eV, $E = -13.6$ eV.
:::

:::formula{title="Speed in the nth orbit"}
$$v_n = \frac{e^2}{2\varepsilon_0 n h}$$
$$v_n = \frac{2.2 \times 10^6}{n}\ \text{m/s}$$
Not written out in NCERT, but it follows from NCERT Eqs. (12.3) and (12.5); NCERT Exercise 12.6 asks for it. So $v_n \propto 1/n$.
:::

:::formula{title="Period and frequency of revolution"}
$$T_n = \frac{2\pi r_n}{v_n} \propto n^3$$
$$f_n = \frac{v_n}{2\pi r_n} \propto \frac{1}{n^3}$$
Ground state: $f_1 \approx 6.6 \times 10^{15}$ Hz (NCERT Example 12.4). Classical theory says the atom would emit light of this frequency. In Bohr's model it does **not**: the emitted frequency is $(E_i - E_f)/h$.
:::

## Energy levels to remember

| $n$ | $E_n$ (eV) | Name |
| --- | --- | --- |
| 1 | $-13.6$ | Ground state |
| 2 | $-3.40$ | First excited state |
| 3 | $-1.51$ | Second excited state |
| 4 | $-0.85$ | Third excited state |
| $\infty$ | 0 | Electron free (ionised) |

- **Ionisation energy** (from $n = 1$): 13.6 eV.
- **Excitation energy** $n = 1 \to 2$: 10.2 eV; $n = 1 \to 3$: 12.09 eV; $n = 1 \to 4$: 12.75 eV.

## Hydrogen spectrum

:::formula{title="Wavelength of the emitted photon"}
$$\lambda = \frac{hc}{E_{n_i} - E_{n_f}}$$
$$\lambda\,(\text{nm}) \approx \frac{1240}{\Delta E\,(\text{eV})}$$
$n_i > n_f$. The 1240 shortcut uses $hc \approx 1240$ eV nm.
:::

:::formula{title="Rydberg formula (exam extra, not in NCERT text)"}
$$\frac{1}{\lambda} = R\left(\frac{1}{n_f^2} - \frac{1}{n_i^2}\right)$$
$R = 1.097 \times 10^7$ m⁻¹ (Rydberg constant), $1/R \approx 91$ nm. For hydrogen only. "Hydrogen spectrum" is in the JEE Main and NEET syllabi; current NCERT shows the series only in Fig. 12.5.
:::

| Series | Ends on $n_f$ | Region |
| --- | --- | --- |
| Lyman | 1 | Ultraviolet |
| Balmer | 2 | Visible, near UV |
| Paschen | 3 | Infrared |
| Brackett | 4 | Infrared |
| Pfund | 5 | Infrared |

Lyman, Balmer and Paschen are named in NCERT Fig. 12.5 (series limits 91 nm, 365 nm, 820 nm). Which $n_f$ each series ends on, and Brackett and Pfund, are exam extras.

:::formula{title="Number of spectral lines (exam extra)"}
$$N = \frac{n(n-1)}{2}$$
Lines possible when many atoms fall from level $n$ to the ground state. A **single** atom gives at most $n - 1$ photons.
:::

## Hydrogen-like ions (exam extra)

One electron, nuclear charge $Ze$: He⁺ ($Z = 2$), Li²⁺ ($Z = 3$). NCERT names these "hydrogenic atoms" but gives the formulas for hydrogen only. Replace $e^2$ by $Ze^2$ in the Bohr results:

:::formula{title="Hydrogenic atom"}
$$r_n = 0.53\,\frac{n^2}{Z}\ \text{Å}$$
$$v_n = 2.2 \times 10^6\,\frac{Z}{n}\ \text{m/s}$$
$$E_n = -13.6\,\frac{Z^2}{n^2}\ \text{eV}$$
In the Rydberg formula, $R$ becomes $RZ^2$. The nucleus is taken as fixed.
:::

## de Broglie's explanation

:::formula{title="Standing wave on the orbit"}
$$2\pi r_n = n\lambda$$
$$\lambda = \frac{h}{mv_n}$$
Together they give $mv_n r_n = \dfrac{nh}{2\pi}$, Bohr's second postulate. Uses $p = mv$, valid since $v \ll c$.
:::
