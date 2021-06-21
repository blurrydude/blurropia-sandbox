import { Component, ViewChild, ElementRef, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  @ViewChild('canvas', { static: true })
  canvas: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D;
  private polygons: Polygon[];
  private tiles: number[][];
  private nexttiles: number[][];
  private map: number[][][];

  @Output() @Input() width!: number;
  @Output() @Input() height!: number;
  @Output() @Input() start!: number;
  @Output() @Input() scaleUp!: number;
  @Output() @Input() scale!: number;
  @Output() @Input() noisePass!: number;
  @Output() @Input() noise!: number;
  @Output() @Input() water!: number;
  @Output() @Input() deepwater!: number;
  @Output() @Input() mountain!: number;
  @Output() @Input() snow!: number;
  @Output() @Input() beach!: number;
  @Output() @Input() foothill!: number;
  @Output() @Input() textureNoise!: number;
  @Output() @Input() tileSofteningPass!: number;
  @Output() @Input() edgeSofteningPass!: number;
  @Output() dataURL!: string;
  private coords!: string;
  private coordsx!: number;
  private coordsy!: number;

  getRandomInt(exclusiveMax: number): number {
    return Math.floor(Math.random() * exclusiveMax);
  }

  seedTiles(w: number, h: number): void {
    this.tiles = [];
    // let's make a grid of random values.
    for (var x = 0; x < w; x++) {
      this.tiles[x] = [];
      for (var y = 0; y < h; y++) {
        var r = this.getRandomInt(16)*16;
        this.tiles[x][y] = r;
      }
    }
  }

  scaleTilesUp(): void {
    this.nexttiles = [];
    // let's scale our previous grid up 2x
    var width = this.tiles.length;
    var height = this.tiles[0].length;
    for (var x = 0; x < width; x++) {
      this.nexttiles[x*2] = [];
      this.nexttiles[x*2+1] = [];
      for (var y = 0; y < height; y++) {
        var o1 = this.tiles[x][y];
        var o2 = x + 1 < width ? this.tiles[x + 1][y] : o1;
        var o3 = y + 1 < height ? this.tiles[x][y + 1] : o1;
        var o4 = x + 1 < width && y + 1 < height ? this.tiles[x + 1][y + 1] : o1;
        var tx = x * 2;
        var ty = y * 2;
        this.nexttiles[tx][ty] = o1;
        this.nexttiles[tx + 1][ty] = (o1 + o2) / 2;
        this.nexttiles[tx][ty + 1] = (o1 + o3) / 2;
        this.nexttiles[tx + 1][ty + 1] = (o1 + o4) / 2;
      }
    }

    this.tiles = this.nexttiles;
    this.nexttiles = [];
  }

  addNoise(): void {
    // let's add noise for breaking up the orignal grid a bit, otherwise mountains will look like pyramids, and so on.
    for (var x = 0; x < this.tiles.length; x++) {
      for (var y = 0; y < this.tiles[0].length; y++) {
        var o = this.tiles[x][y];
        var p = (this.getRandomInt(this.noise * 2) + 1 - this.noise) / 100;
        this.tiles[x][y] = Math.max(0, Math.min(255, Math.round(o * p) + o));
      }
    }
  }

  squish(): void {
    for (var x = 0; x < this.tiles.length; x++) {
      for (var y = 0; y < this.tiles[0].length; y++) {
        this.tiles[x][y] = Math.round(this.tiles[x][y] / 16) * 16; 
      }
    }
  }

  loadPolygons(): void {
    console.log("loading polygons: starting="+this.start+" scale:"+this.scaleUp);
    this.seedTiles(this.start, this.start);
    for (var x = 1; x < this.scaleUp; x++) {
      this.scaleTilesUp();
      if (x > 1 && x < this.tileSofteningPass+1) {
        this.squish();
        this.softenTileEdges();
      }
      if (x < this.noisePass) {
        this.addNoise();
      }
    }

    this.loadTiles();
    this.draw();
    
    /*this.polygons = [
      new Polygon(this.ctx, [
        [10, 10],
        [150, 150],
        [10, 200]
      ], 'blue', () => {
        console.log('works');
      })
    ];*/
  }

  loadTiles(): void {
    this.polygons = [];

    for (let x = 0; x < this.tiles.length; x++) {
      let tx = x * this.scale;

      for (let y = 0; y < this.tiles[0].length; y++) {
        let ty = y * this.scale;
        if (this.tiles[x][y] === undefined) {
          console.log("undefined " + x + "," + y);
          continue;
        }
        let cv = this.tiles[x][y];
        let color = cv < this.deepwater ? [  0,   0, 128] :
                    cv < this.water ?     [  0,   0, 255] :
                    cv < this.beach ?     [255, 196,   0] :
                    cv > this.snow ?      [255, 255, 255] :
                    cv > this.mountain ?  [196, 196, 196] :
                    cv > this.foothill ?  [  0, 128,   0] :
                    [0, 212, 0];
        if (this.map === undefined) this.map = [];
        if (this.map[x] === undefined) this.map[x] = [];
        if (this.map[x][y] === undefined) this.map[x][y] = [];
        this.map[x][y] = color;
      }
    }

    for (var i = 0; i < this.edgeSofteningPass; i++) {
      this.softenMapEdges();
    }

    for (let x = 0; x < this.tiles.length; x++) {
      let tx = x * this.scale;

      for (let y = 0; y < this.tiles[0].length; y++) {
        let ty = y * this.scale;
        let cv = this.map[x][y];
        let color = this.randomizedHue(this.textureNoise, cv[0], cv[1], cv[2])
        this.polygons.push(new Polygon(this.ctx, [
          [tx, ty],
          [tx + this.scale, ty],
          [tx + this.scale, ty + this.scale],
          [tx, ty + this.scale],
        ], color, (e: MouseEvent) => {
            this.coords = x + ',' + y;
            let w = this.ctx.measureText(this.coords).width;
            this.coordsx = e.offsetX - Math.round(w / 2);
            this.coordsy = e.offsetY - 12;
            if (this.coordsx + w > this.width) {
              this.coordsx = this.coordsx - w;
            }
            if (this.coordsy + 12> this.height) {
              this.coordsy = this.coordsy - 12;
            }
          console.log(x + ',' + y);
        }));
      }
    }
    this.width = this.tiles.length * this.scale;
    this.height = this.tiles[0].length * this.scale;
    this.canvas.nativeElement.width = this.width;
    this.canvas.nativeElement.height = this.height;
  }

  softenTileEdges(): void {
    var newmap = [];
    newmap[0] = this.tiles[0];
    for (let x = 1; x < this.tiles.length; x++) {
      newmap[x] = [];
      newmap[x][0] = this.tiles[x][0];
      for (let y = 1; y < this.tiles[0].length; y++) {
        if (this.tiles[x][y] != this.tiles[x - 1][y] || this.tiles[x][y - 1]) {
          let a = Math.round((this.tiles[x][y] + this.tiles[x - 1][y] + this.tiles[x][y - 1]) / 3);
          newmap[x][y] = a;
        } else {
          newmap[x][y] = this.map[x][y];
        }
      }
    }

    this.map = newmap;
  }

  softenMapEdges(): void {
    var newmap = [];
    newmap[0] = this.map[0];
    for (let x = 1; x < this.map.length; x++) {
      newmap[x] = [];
      newmap[x][0] = this.map[x][0];
      for (let y = 1; y < this.map[0].length; y++) {
        if (this.map[x][y] != this.map[x - 1][y] || this.map[x][y - 1]) {
          let a = [
            Math.round((this.map[x][y][0] + this.map[x - 1][y][0] + this.map[x][y - 1][0]) / 3),
            Math.round((this.map[x][y][1] + this.map[x - 1][y][1] + this.map[x][y - 1][1]) / 3),
            Math.round((this.map[x][y][2] + this.map[x - 1][y][2] + this.map[x][y - 1][2]) / 3)
          ];
          newmap[x][y] = a;
        } else {
          newmap[x][y] = this.map[x][y];
        }
      }
    }

    this.map = newmap;
  }

  randomizedHue(p: number, r: number, g: number, b: number): string {

    var sp = (this.getRandomInt(p * 2) + 1 - p) / 100;
    var nr = (Math.max(0, Math.min(255, Math.round(r * sp + r)))).toString(16); if (nr.length == 1) nr = "0" + nr;
    var ng = (Math.max(0, Math.min(255, Math.round(g * sp + g)))).toString(16); if (ng.length == 1) ng = "0" + ng;
    var nb = (Math.max(0, Math.min(255, Math.round(b * sp + b)))).toString(16); if (nb.length == 1) nb = "0" + nb;
    var color = "#" + nr + ng + nb;
    return color;
    //return "#" + r + g + b;
  }

  ngOnInit(): void {
    this.start = 4;
    this.scaleUp = 8;
    this.noise = 10;
    this.noisePass = 5;
    this.scale = 1;
    this.water = 96;
    this.mountain = 195;
    this.snow = 245;
    this.beach = 103;
    this.foothill = 180;
    this.deepwater = 32;
    this.textureNoise = 6;
    this.edgeSofteningPass = 1;
    this.tileSofteningPass = 3;
    let ctx1 = this.canvas.nativeElement.getContext('2d');
    if (ctx1) {
      this.ctx = ctx1;
    }
    this.loadPolygons();
  }

  draw(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.font = '16 px "Open Sans",Arial,Helvetica,sans-serif';
    

    for (var i = 0; i < this.polygons.length; i++) {
      this.polygons[i].draw();
    }
    this.ctx.fillStyle = 'black';
    this.ctx.fillText(this.coords, this.coordsx, this.coordsy)
    this.dataURL = this.canvas.nativeElement.toDataURL();
    //setTimeout(this.draw, 200);
  }

  clicked(e: MouseEvent): void {
    for (var i = 0; i < this.polygons.length; i++) {
      let check = this.polygons[i].inside(e.offsetX, e.offsetY);
      if (check === true) {
        this.polygons[i].click(e);
      }
    }
    this.draw();
  }
}

export class Polygon {
  points: number[][];
  color: string;
  constructor(private ctx: CanvasRenderingContext2D, points: number[][], color: string, click: (e: MouseEvent) => void) { this.points = points; this.color = color; this.click = click; }

  click: (e: MouseEvent) => void;

  draw(): void {
    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.moveTo(this.points[0][0], this.points[0][1]);
    for (var i = 1; i < this.points.length; i++) {
      this.ctx.lineTo(this.points[i][0], this.points[i][1]);
    }
    this.ctx.fill();
  }

  inside(x: number, y: number): boolean {
    // ray-casting algorithm based on
    // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html/pnpoly.html

    var inside = false;
    for (var i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
      var xi = this.points[i][0], yi = this.points[i][1];
      var xj = this.points[j][0], yj = this.points[j][1];

      var intersect = ((yi > y) != (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  };
}
