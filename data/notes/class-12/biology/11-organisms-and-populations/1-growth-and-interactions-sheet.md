---
title: "Organisms and Populations: Equations and Tables Sheet"
type: formula_sheet
chapter: c12.biology.organisms-and-populations
order: 1
---

## Rates are per head (per capita)

:::formula{title="Birth rate and death rate"}
$$\text{birth rate} = \frac{\text{births}}{\text{population}}$$
$$\text{death rate} = \frac{\text{deaths}}{\text{population}}$$
NCERT examples: 20 lotus plants + 8 new ones → $8/20 = 0.4$ offspring per lotus per year. 4 of 40 fruit flies die in a week → $4/40 = 0.1$ per fruit fly per week.
:::

## Change in population density

:::formula{title="Density at the next time step"}
$$N_{t+1} = N_t + [(B + I) - (D + E)]$$
$N_t$ = density at time $t$, $B$ = births (natality), $I$ = immigrants, $D$ = deaths (mortality), $E$ = emigrants.

$N$ goes **up** if $(B + I) > (D + E)$.
:::

## Exponential growth (resources unlimited)

:::formula{title="Exponential growth: rate form"}
$$\frac{dN}{dt} = (b - d) \times N$$
$$r = b - d$$
$$\frac{dN}{dt} = rN$$
$b$ = per capita birth rate, $d$ = per capita death rate, $r$ = **intrinsic rate of natural increase**.

Graph of $N$ against time: **J-shaped** curve.
:::

:::formula{title="Exponential growth: integral form"}
$$N_t = N_0\,e^{rt}$$
$N_t$ = density after time $t$, $N_0$ = density at time zero, $e$ = base of natural logarithms (2.71828).
:::

:::formula{title="Doubling time (beyond NCERT aid)"}
Not written in NCERT, but it follows from $N_t = N_0 e^{rt}$. Put $N_t = 2N_0$:
$$e^{rt} = 2$$
$$t = \frac{\ln 2}{r} \approx \frac{0.693}{r}$$
Use: a population that doubles in 3 years has $r = 0.693/3 \approx 0.23$ per year.
:::

## Logistic growth (resources limited)

:::formula{title="Verhulst-Pearl logistic growth"}
$$\frac{dN}{dt} = rN\left(\frac{K - N}{K}\right)$$
$N$ = density at time $t$, $r$ = intrinsic rate of natural increase, $K$ = **carrying capacity**.

Graph of $N$ against time: **sigmoid (S-shaped)** curve.
:::

| When | $\frac{K-N}{K}$ | Growth |
| --- | --- | --- |
| $N$ much less than $K$ | close to 1 | almost $rN$ (like exponential) |
| $N = K/2$ | 1/2 | fastest, $rK/4$ (beyond NCERT) |
| $N = K$ | 0 | zero (asymptote) |

The $K/2$ row is a beyond-NCERT aid: NCERT does not say where growth is fastest.

Phases of the sigmoid curve: **lag → acceleration → deceleration → asymptote** (at $K$).

## r values given in NCERT

| Organism | r |
| --- | --- |
| Norway rat | 0.015 |
| Flour beetle | 0.12 |
| Human population of India (1981) | 0.0205 |

## Age pyramids (Figure 11.1)

| Shape | Base (pre-reproductive) | Population is |
| --- | --- | --- |
| Expanding | Widest | Growing |
| Stable | About equal to reproductive | Stable |
| Declining | Narrower than reproductive | Declining |

The three layers, bottom to top: pre-reproductive, reproductive, post-reproductive. Expanding, stable and declining are NCERT's names. Other books call them triangle, bell and urn shapes; those names are not used in NCERT.

## Population interactions (Table 11.1)

| Species A | Species B | Interaction |
| --- | --- | --- |
| + | + | Mutualism |
| – | – | Competition |
| + | – | Predation |
| + | – | Parasitism |
| + | 0 | Commensalism |
| – | 0 | Amensalism |

+ = benefit, – = harm, 0 = neither.

## NCERT examples at a glance

| Interaction | Examples |
| --- | --- |
| Predation | Tiger–deer; sparrow eating seeds; moth controlling prickly pear in Australia; starfish *Pisaster* |
| Competition | Flamingoes and fishes (zooplankton); goats and Abingdon tortoise; *Balanus* and *Chathamalus* (NCERT's spelling; the genus is usually spelt *Chthamalus*) |
| Parasitism | Lice, ticks, copepods, *Cuscuta*; liver fluke; malarial parasite; cuckoo (brood parasite) |
| Commensalism | Orchid on mango; barnacles on whale; cattle egret and cattle; clown fish and sea anemone |
| Mutualism | Lichens; mycorrhizae; fig and wasp; orchid and bee |

## Scientists

| Scientist | Known for (in this chapter) |
| --- | --- |
| Ramdeo Misra | Father of Ecology in India |
| Verhulst and Pearl | Logistic growth equation |
| Gause | Competitive Exclusion Principle |
| Connell | Barnacle experiments, Scotland |
| MacArthur | Five warbler species on one tree (resource partitioning) |
