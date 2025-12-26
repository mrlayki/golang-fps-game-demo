package game

type Map struct {
	Rows []string `json:"rows"`
}

func DefaultMap() Map {
	return Map{
		Rows: []string{
			"################",
			"#..............#",
			"#..####..####..#",
			"#..#......#....#",
			"#..#..##..#..#.#",
			"#......#.......#",
			"#..##..#..##...#",
			"#..#......#....#",
			"#..####..####..#",
			"#..............#",
			"################",
		},
	}
}

func (m Map) IsWall(x, y float64) bool {
	ix := int(x)
	iy := int(y)
	if iy < 0 || iy >= len(m.Rows) {
		return true
	}
	row := m.Rows[iy]
	if ix < 0 || ix >= len(row) {
		return true
	}
	return row[ix] == '#'
}

