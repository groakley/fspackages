class WT_Nearest_Airports_Airports_Input_Layer extends Selectables_Input_Layer {
    constructor(model, view) {
        super(new Selectables_Input_Layer_Dynamic_Source(view.elements.airportList, ".ident"));
        this.model = model;
        this.view = view;
    }
    onDirectTo() {
        if (this.selectedElement)
            this.model.directTo(this.selectedElement.parentNode.dataset.icao);
    }
}

class WT_Nearest_Airports_View extends WT_HTML_View {
    constructor() {
        super();
        this.inputStackHandle = null;

        this.menu = this.initMenu();

        this.flightPlanElement = new SvgFlightPlanElement();
        this.flightPlanElement.source = new WT_Flight_Plan_Waypoints();
        this.flightPlanElement.flightPlanIndex = 10;
        this.flightPlanElement.setAsDashed(true);

        this.selectedRunway = new Subject();
    }
    initMenu() {
        let menu = new WT_Soft_Key_Menu(false);
        menu.addSoftKey(5, new WT_Soft_Key("APT", this.browseAirports.bind(this)));
        menu.addSoftKey(6, new WT_Soft_Key("RNWY", this.browseRunways.bind(this)));
        menu.addSoftKey(7, new WT_Soft_Key("FREQ", this.browseFrequencies.bind(this)));
        menu.addSoftKey(8, new WT_Soft_Key("APR", this.browseApproaches.bind(this)));
        return menu;
    }
    popInput() {
        if (this.inputStackHandle) {
            this.inputStackHandle.pop();
            this.inputStackHandle = null;
        }
    }
    browseAirports() {
        this.popInput();
        this.inputStackHandle = this.inputStack.push(this.airportsInputLayer);
    }
    browseRunways() {
        this.popInput();
        this.inputStackHandle = this.inputStack.push(this.runwaysInputLayer);
    }
    browseFrequencies() {
        this.popInput();
        this.inputStackHandle = this.inputStack.push(this.frequenciesInputLayer);
    }
    browseApproaches() {
        this.popInput();
        this.inputStackHandle = this.inputStack.push(this.approachesInputLayer);
    }
    connectedCallback() {
        let template = document.getElementById('nearest-airports-page');
        let templateContent = template.content;

        this.appendChild(templateContent.cloneNode(true));
        super.connectedCallback();

        DOMUtilities.AddScopedEventListener(this.elements.airportList, ".ident", "highlighted", e => {
            this.model.setSelectedAirport(e.detail.element.parentNode.dataset.icao);
            e.detail.element.parentNode.querySelector(".arrow").appendChild(this.elements.arrow);
        });

        this.elements.arrow = document.createElement("div");
        this.elements.arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewbox="0 0 100 100">
            <path d="M0 30 L50 30 L50 0 L100 50 L50 100 L50 70 L0 70 z" fill="white"></path>
        </svg>`;

        this.selectedRunway.subscribe(runway => {
            if (runway) {
                this.elements.runwaySurface.textContent = runway.getSurfaceString();
                this.elements.runwayLength.textContent = runway.length.toFixed(0) + "FT";
                this.elements.runwayWidth.textContent = runway.width.toFixed(0) + "FT";
            }
        });

        this.elements.runwaySelector.addEventListener("change", e => {
            this.selectedRunway.value = this.runways[this.elements.runwaySelector.value];
        });
    }
    /**
     * @param {WT_Nearest_Airports_Model} model 
     */
    setModel(model) {
        this.model = model;
        model.airports.subscribe(this.updateAirports.bind(this));
        model.selectedAirport.subscribe(this.updateSelectedAirport.bind(this));
        this.map = this.model.mapInstrument;
        this.elements.map.appendChild(this.map);

        this.airportsInputLayer = new WT_Nearest_Airports_Airports_Input_Layer(this.model, this);
        this.runwaysInputLayer = new Selectables_Input_Layer(new Selectables_Input_Layer_Dynamic_Source(this.elements.runways));
        this.frequenciesInputLayer = new Selectables_Input_Layer(new Selectables_Input_Layer_Dynamic_Source(this.elements.frequencyList));
        this.approachesInputLayer = new Selectables_Input_Layer(new Selectables_Input_Layer_Dynamic_Source(this.elements.approachList));
    }
    updateSelectedRunway(runway) {
        this.elements.runwayDesignation = runway.designation;
        this.elements.runwaySurface = runway.getSurfaceString();
        this.elements.runwayLength = fastToFixed(runway.length, 0) + "FT";
        this.elements.runwayWidth = fastToFixed(runway.width, 0) + "FT";
    }
    updateSelectedAirport(airport) {
        if (airport == null)
            return;
        let infos = airport.airport.GetInfos();
        if (infos && infos.icao != "" && infos.getWaypointType() == "A" && infos.IsUpToDate()) {
            this.elements.facilityName.textContent = infos.name;
            this.elements.city.textContent = infos.city;
            if (infos.coordinates) {
                this.elements.elevation = fastToFixed(infos.coordinates.alt, 0) + "FT";
            }
            this.runways = {};
            let selectedRunway = "";
            for (let runway of infos.runways) {
                let name = runway.designation;//`${runway.designatorCharPrimary}-${runway.designatorCharSecondary}`;
                this.runways[name] = runway;
                if (selectedRunway == "") {
                    selectedRunway = name;
                }
            }
            this.elements.runwaySelector.values = Object.keys(this.runways);
            this.elements.runwaySelector.value = selectedRunway;
            this.elements.runwaySelector.fireChangeEvent();
            if (infos.frequencies) {
                let elems = [];
                for (let i = 0; i < infos.frequencies.length; i++) {
                    elems.push(`<li class="element"><span class="name">${infos.frequencies[i].name}</span><span class="value selectable" data-frequency="${infos.frequencies[i].mhValue}">${infos.frequencies[i].mhValue.toFixed(2)}</span></li>`);
                }
                this.elements.frequencyList.innerHTML = elems.join("");
            }
            if (infos.approaches) {
                let elems = [];
                for (let i = 0; i < infos.approaches.length; i++) {
                    elems.push(`<li class="element selectable" data-approach="${i}"><span class="name">${infos.ident}-${infos.approaches[i].name}</span></li>`);
                }
                this.elements.approachList.innerHTML = elems.join("");
            }

            let lat = SimVar.GetSimVarValue("PLANE LATITUDE", "degree latitude");
            let long = SimVar.GetSimVarValue("PLANE LONGITUDE", "degree longitude");
            let planeCoordinates = new LatLong(lat, long);
            this.map.centerOnCoordinate(planeCoordinates, [infos.coordinates], 50);
            this.flightPlanElement.source.waypoints = [{
                ident: "",
                infos: {
                    coordinates: new LatLongAlt(planeCoordinates.lat, planeCoordinates.long, 0)
                }
            }, airport.airport];
        }
    }
    updateAirports(airports) {
        let listElement = this.elements.airportList;

        if (!airports)
            return;

        let elements = [];
        for (let airport of airports) {
            if (airport == null)
                continue;
            let element = listElement.querySelector(`[data-icao="${airport.icao}"]`);
            if (!element) {
                element = document.createElement("li");
                element.innerHTML = `
                    <span class="arrow"></span>
                    <span class="ident"></span>
                    <airport-icon></airport-icon>
                    <span class="bearing"><span></span>°</span>
                    <span class="distance"><span></span><span class='small'></span></span>
                `;
                element.querySelector(".ident").innerHTML = airport.ident;
                element.querySelector("airport-icon").angle = airport.longestRunwayDirection;
                element.querySelector("airport-icon").applyInfo(airport);
            }
            element.dataset.icao = airport.icao;
            Avionics.Utils.diffAndSet(element.querySelector(".bearing span"), airport.bearing.toFixed(0));
            Avionics.Utils.diffAndSet(element.querySelector(".distance span:first-child"), this.model.unitChooser.chooseDistance((airport.distance * 1.852).toFixed(1), airport.distance.toFixed(1)));
            Avionics.Utils.diffAndSet(element.querySelector(".distance .small"), this.model.unitChooser.chooseDistance("KM", "NM"));
            elements.push(element);
        }

        DOMUtilities.repopulateElement(listElement, elements);
    }
    update(dt) {
        if (this.model)
            this.model.update(dt);
    }
    exit() {
        this.popInput();
    }
    enter(inputStack) {
        this.inputStack = inputStack;
        this.browseAirports();
    }
    activate() {
        this.previousMenu = this.model.softKeyController.currentMenu;
        this.model.softKeyController.setMenu(this.menu);
        this.map.flightPlanElements.push(this.flightPlanElement);
        this.map.showFlightPlan = false;
    }
    deactivate() {
        this.model.softKeyController.setMenu(this.previousMenu);
        this.map.flightPlanElements.splice(this.map.flightPlanElements.findIndex(item => item == this.flightPlanElement), 1);
        this.map.showFlightPlan = true;
        this.model.unsubscribe();
    }
}
customElements.define("g1000-nearest-airports-page", WT_Nearest_Airports_View);