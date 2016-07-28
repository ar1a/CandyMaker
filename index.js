var fs = require("fs");
var pogobuf = require("pogobuf");
var POGOProtos = require("node-pogo-protos");


var settings = JSON.parse(fs.readFileSync("./config.json", "utf8"));


var username = settings.username;
var password = settings.password;
var provider = settings.provider;
var apikey = settings.apikey;

var geocoder = require("node-geocoder")({
  provider: "google",
  httpAdapter: "https",
  apiKey: apikey,
  formatter: null
});

var location;

var client = new pogobuf.Client(),
  login;
if (provider === "ptc") {
  login = new pogobuf.PTCLogin();
} else if (provider === "google") {
  login = new pogobuf.GoogleLogin();
} else {
  console.log("ERROR! Provider must be either 'ptc' or 'google'");
  process.exit(1);
}

//these are here because npm hasn't been updated with the new stuff and I want to use it.
splitInventory = function(inventory) {
  if (!inventory || !inventory.inventory_delta || !inventory.inventory_delta.inventory_items)
    return {};

  var pokemon = [],
    items = [],
    pokedex = [],
    player = null,
    currency = [],
    camera = null,
    inventory_upgrades = [],
    applied_items = [],
    egg_incubators = [],
    candies = [];

  inventory.inventory_delta.inventory_items.forEach(item => {
    var itemdata = item.inventory_item_data;
    if (itemdata.pokemon_data) {
      pokemon.push(itemdata.pokemon_data);
    }
    if (itemdata.item) {
      items.push(itemdata.item);
    }
    if (itemdata.pokedex_entry) {
      pokedex.push(itemdata.pokedex_entry);
    }
    if (itemdata.player_stats) {
      player = itemdata.player_stats;
    }
    if (itemdata.player_currency) {
      currency.push(itemdata.player_currency);
    }
    if (itemdata.player_camera) {
      camera = itemdata.player_camera;
    }
    if (itemdata.inventory_upgrades) {
      inventory_upgrades.push(itemdata.inventory_upgrades);
    }
    if (itemdata.applied_items) {
      applied_items.push(itemdata.applied_items);
    }
    if (itemdata.egg_incubators) {
      egg_incubators.push(itemdata.egg_incubators);
    }
    if (itemdata.pokemon_family) {
      candies.push(itemdata.pokemon_family);
    }
  });

  return {
    pokemon: pokemon,
    items: items,
    pokedex: pokedex,
    player: player,
    currency: currency,
    camera: camera,
    inventory_upgrades: inventory_upgrades,
    applied_items: applied_items,
    egg_incubators: egg_incubators,
    candies: candies
  };
}

getEnumKeyByValue = function(enumObj, val) {
  for (var key of Object.keys(enumObj)) {
    if (enumObj[key] === val)
      return key.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
  }
  return null;
}


geocoder.geocode(settings.location)
  .then(loc => {
    if (!loc.length) throw Error("no location found");
    location = loc;

    return login.login(username, password);
  })
  .then(token => {
    client.setAuthInfo(provider, token);
    client.setPosition(location.latitude, location.longitude);
    return client.init();
  }).then(() => {
    return client.getInventory(0);
  }).then(inventory => {
    if (!inventory.success) throw Error("success=false in inventory response");
    inventory = splitInventory(inventory);
    var pokemon = [];
    inventory.pokemon.forEach(poke => {
      if (poke.pokemon_id === 0) return;
      pokemon.push(poke);
    });

    client.batchStart();
    pokemon.forEach(poke => {
      for(var i = 0; i < pokemon.length; i++) {
        if(pokemon[i].pokemon_id === poke.pokemon_id) {
          if(pokemon[i].cp < poke.cp) {
            client.releasePokemon(pokemon[i].id);
            console.log("Releasing pokemon: " + getEnumKeyByValue(POGOProtos.Enums.PokemonId, pokemon[i].pokemon_id) + " because " + pokemon[i].cp.toString() + " < " + poke.cp.toString());
          }
        }
      }
    });
    client.batchCall();

  }).catch(console.error);