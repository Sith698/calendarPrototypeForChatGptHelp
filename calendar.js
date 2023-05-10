// Amélioration possibles :
// - Eviter de récupérer toutes les affectations qui ont commencé cette année alors qu'on affiche seulement une période et seulement quelques ressource. Faire un filtre.
// - Eviter de requeter de nouveau TOUTES les affectations lorsqu'on change les filtres. Garder en mémoire les affectations réquetées et filtrer dessus serait une meilleure idée.
// - Eviter d'itérer sur CHAQUE affectation pour CHAQUE ressource et pour CHAQUE jour ! dans refreshAffectations(). Il vaudrait mieux faire une Map<Ressource,Map<Jour de l'affectation,List<Affectation>>

import { LightningElement, track, wire } from "lwc";
import { updateRecord } from "lightning/uiRecordApi";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { NavigationMixin } from "lightning/navigation";

import LANG from '@salesforce/i18n/lang';
import LOCALE from '@salesforce/i18n/locale';
import DTformat from '@salesforce/i18n/dateTime.shortDateFormat';

import { Calendar } from "./model/Calendar";
import { Ressource } from "./model/Ressource";
import { RessourceMaterielle } from "./model/RessourceMaterielle";
import { Affectation } from "./model/Affectation";
import { numberOfDayPerMonth } from "./helper/calendarHelper";
import { PeriodeManager } from "./services/PeriodeManager";
import { FiltreManager } from "./services/FiltreManager";
import { FiltreRessExtManager } from "./services/FiltreRessExtManager";
import { FiltreRessMatManager } from "./services/FiltreRessMatManager";
import { Societe } from "./model/Societe";
import { Direction } from "./model/Direction";
import { Service } from "./model/Service";
import { Etablissement } from "./model/Etablissement";
import { DirectionService } from "./model/DirectionService";
import { SocieteEtablissement } from "./model/SocieteEtablissement";
import { RessourceType } from "./model/RessourceType";
import { RessourceManager } from "./services/RessourceManager";
import { RessourceMatManager } from "./services/RessourceMatManager";
import { Fonction } from "./model/Fonction";
import { Tiers } from "./model/Tiers";

import getAllRessourcesHumaines from "@salesforce/apex/PosteDeCarriereController.getAllRessourcesHumaines";
import getAllRessourcesExternes from "@salesforce/apex/PosteDeCarriereController.getAllRessourcesExternes";
import getAllRessourcesMaterielles from "@salesforce/apex/PosteDeCarriereController.getAllRessourcesMaterielles";
import getAffectations from "@salesforce/apex/AffectationController.getAffectations";
import getAffectationsByDates from "@salesforce/apex/AffectationController.getAffectationsByDates";
import getAllSocietes from "@salesforce/apex/SocieteController.getAllSocietes";
import getAllDirections from "@salesforce/apex/DirectionController.getAllDirections";
import getAllServices from "@salesforce/apex/ServiceController.getAllServices";
import getAllEtablissements from "@salesforce/apex/EtablissementController.getAllEtablissements";
import getAllDirectionsServices from "@salesforce/apex/DirectionServiceController.getAllDirectionsService";
import getAllSocietesEtablissements from "@salesforce/apex/SocieteEtablissementController.getAllSocietesEtablissements";
import getJourFerie from "@salesforce/apex/JourFerieController.GetjourFerieDefautSociete";
import reCalculateEndDateTimeAfterDragDrop from "@salesforce/apex/ElapsedTime.reCalculateEndDateTimeAfterDragDrop";
import getRessourceTypes from "@salesforce/apex/LWC_PlanningFiltersController.getRessourceTypes";
import getMaterialTypes from "@salesforce/apex/LWC_PlanningFiltersController.getMaterialTypes";
import getFonctions from "@salesforce/apex/LWC_PlanningFiltersController.getFonctions";
import getTiers from "@salesforce/apex/LWC_PlanningFiltersController.getAllActiveTiers";


import AFFECTATIONS_ID from "@salesforce/schema/Affectation__c.Id";
import AFFECTATIONS_START_DATE from "@salesforce/schema/Affectation__c.DateDeDebut__c";
import AFFECTATIONS_END_DATE from "@salesforce/schema/Affectation__c.DateDeFin__c";
import AFFECTATIONS_RESSOURCES from "@salesforce/schema/Affectation__c.RessourceHumaine__c";
import AFFECTATIONS_RESSOURCES_MAT from "@salesforce/schema/Affectation__c.RessourceMaterielle__c";

export default class CalendarPrototypes2Modulaire extends NavigationMixin(
    LightningElement
) {
    @track getAffect;

    @track isRessHum = true ;
    @track isRessExt = false ;
    idSalarie = "" ;

    _startDate;
    _endDate;
    @track _calendar;
    @track _ressourceAff = [];
    @track _periodeManager;
    @track _filtreManager;
    @track _filtreRessExtManager;
    @track _filtreRessMatManager;
    _ressourceManager;
    _ressourceMatManager;
    @track _reload;

    @track _currentDirection;
    @track _currentService;
    @track _currentEtablissement;

    @track _currentTiers;

    @track _currentRessourceType;
    @track _currenFonction;

    @track _societeOptions = [];
    @track _directionOptions = [];
    @track _serviceOptions = [];
    @track _etablissementOptions = [];
    @track _clientOptions = [];

    @track _ressourceTypeOptions = [];
    @track _fonctionOptions = [] ;

    @track _jourFerie = [];
    _draggingAffectation;

    _clickedDayDate;
    _clickedDayMonth;
    _clickedDayYear;
    _clickedDayRHId;

    //@track _recordData

    get recordData() {
        console.log('YGT 21 10 recordData ressType : '+this._currentRessourceType);
        let recordData ;
        if(this._currentRessourceType=="ressMat"){
            recordData = this._clickedDayRHId !== undefined
                ? [this._clickedDayRHId, "RessourceMaterielle__c"]
                : [null, null];
        } else {
            recordData = this._clickedDayRHId !== undefined
                ? [this._clickedDayRHId, "RessourceHumaine__c"]
                : [null, null];
        }
        /*let recordData =
            this._clickedDayRHId !== undefined
                ? [this._clickedDayRHId, "RessourceHumaine__c"]
                : [null, null];*/
                console.log('YGT 21 10 this._recordData : '+recordData)   
        return recordData;
    }

    get startDateTimeVal() {
        let startDateTimeVal =
            this._clickedDayYear !== undefined &&
            this._clickedDayMonth !== undefined &&
            this._clickedDayDate !== undefined
                ? `${this._clickedDayYear}-${this._clickedDayMonth + 1}-${this._clickedDayDate}T12:00:00+02:00`
                : `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDay()}T12:00:00+02:00`;
        return startDateTimeVal;
    }

    constructor() {
        super();
        this.initPeriode();
        this._periodeManager = new PeriodeManager(
            this._startDate,
            this._endDate
        );
        this._filtreManager = new FiltreManager();
        this._filtreRessMatManager = new FiltreRessMatManager();
        this._filtreRessExtManager = new FiltreRessExtManager();
        this._ressourceManager = new RessourceManager(this._filtreManager, this._filtreRessExtManager);
        this._ressourceMatManager = new RessourceMatManager(this._filtreRessMatManager);
        this._calendar = new Calendar(this._startDate, this._endDate);
    }

    connectedCallback() {}

    get calendar() {
        return this._calendar;
    }
    get ressourceAff() {
        return this._ressourceAff;
    }
    get periodeManager() {
        return this._periodeManager;
    }
    get filtreManager() {
        return this._filtreManager;
    }
    get filtreRessExtManager() {
        return this._filtreRessExtManager;
    }
    get filtreRessMatManager() {
        return this._filtreRessMatManager;
    }
    get reload() {
        return this._reload;
    }
    get societeOptions() {
        return this._societeOptions;
    }
    get directionOptions() {
        return this._directionOptions;
    }
    get serviceOptions() {
        return this._serviceOptions;
    }
    get etablissementOptions() {
        return this._etablissementOptions;
    }
    get clientOptions() {
        return this._clientOptions;
    }
    get ressourceTypeOptions() {
        return this._ressourceTypeOptions;
    }
    get fonctionOptions() {
        return this._fonctionOptions;
    }

    initPeriode() {
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        currentDate.setDate(1);
        this._startDate = new Date(currentDate.valueOf());
        currentDate.setDate(numberOfDayPerMonth(currentDate));
        this._endDate = new Date(currentDate.valueOf());
    }

    handleChangeStartDay(event) {
        this._periodeManager.startDaySelected = event.detail.value;// parseInt(event.detail.value, 10);
        this.updateDate();
    }

    handleChangeStartmonth(event) {
        this._periodeManager.startMonthSelected = event.detail.value;// parseInt(event.detail.value, 10);
        this.updateDate();
    }

    handleChangeStartYear(event) {
        this._periodeManager.startYearSelected = event.detail.value;// parseInt(event.detail.value, 10);
        this.updateDate();
    }

    handleChangeEndDay(event) {
        this._periodeManager.endDaySelected = event.detail.value;//parseInt(event.detail.value, 10);
        this.updateDate();
    }

    handleChangeEndMonth(event) {
        this._periodeManager.endMonthSelected = event.detail.value;// parseInt(event.detail.value, 10);
        this.updateDate();
    }

    handleChangeEndYear(event) {
        this._periodeManager.endYearSelected = event.detail.value;// parseInt(event.detail.value, 10);
        this.updateDate();
    }

    handleClickResearch(){
        if(this._endDate <= this._startDate){
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Action non autorisée',
                    message: 'Merci de sélectionner une "Date de début" strictement inférieur à la "Date de fin".',
                    variant: 'Error'
                })
            );
        }
        else{
            if((this._endDate-this._startDate)/8.64e7 > 62){
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Attention !',
                        message: 'Merci de sélectionner une période de 62 jours maximum.',
                        variant: 'warning'
                    })
                );
            }
            else{
                this._calendar = new Calendar(this._startDate, this._endDate);
                //this.refreshAffectations();
                this.updateRessourceFiltre();
            }
        }
    }

    razFilters(){
        //Internal RH
        this._filtreManager.currentDirection = "allDirections" ;
        this._filtreManager.currentEtablissement = "allEtablissements" ;
        this._filtreManager.currentFonction = "allFonctions" ;
        this._filtreManager.currentRessourceType = this.idSalarie ;
        this._filtreManager.currentService = "allServices" ;
        this._filtreManager.currentSociete = "allSocietes" ;

        this._filtreManager.updateFiltre();
        this._directionOptions = this._filtreManager.directionOptions;
        this._serviceOptions = this._filtreManager.serviceOptions;
        this._etablissementOptions = this._filtreManager.etablissementOptions;

        this._ressourceManager.filtreManager = this._filtreManager;
        this._ressourceManager._filtreRessExtManager = this._filtreRessExtManager;
        this._ressourceManager.updateRessourceOption();

        //External RH
        this._filtreRessExtManager.currentTiers = "allTiers" ;

        //Material Ressources
        this._filtreRessMatManager.currentEtablissement = "allEtablissements" ;
        this._filtreRessMatManager.currentMaterialType = "allTypes" ;
        this._filtreRessMatManager.currentSociete = "allSocietes" ;

        this._filtreRessMatManager.updateFiltre();

        this._ressourceMatManager.filtreManager = this._filtreRessMatManager;
        this._ressourceMatManager.updateRessourceOption();

        //Flags
        this.isRessExt = false ;
        this.isRessHum = true ;

        //For humans ressources we come back on internal
        this._ressourceAff = this._ressourceManager.ressourceOptions;

        //When reset filters we come back on current month
        this.initPeriode();
        this._periodeManager = new PeriodeManager(
            this._startDate,
            this._endDate
        );
        this._calendar = new Calendar(this._startDate, this._endDate);

        this.refreshAffectations();
    }

    updateDate() {
        this._reload = 0;
        this._startDate.setDate(this._periodeManager.startDaySelected);
        this._startDate.setMonth(this._periodeManager.startMonthSelected);
        this._startDate.setFullYear(this._periodeManager.startYearSelected);

        this._endDate.setDate(this._periodeManager.endDaySelected);
        this._endDate.setMonth(this._periodeManager.endMonthSelected);
        this._endDate.setFullYear(this._periodeManager.endYearSelected);

        this._periodeManager = new PeriodeManager(
            this._startDate,
            this._endDate
        );

        //this._calendar = new Calendar(this._startDate, this._endDate);

        //this.refreshAffectations();
    }

    updateAllFiltreOption() {
        
        if(this.isRessHum){
            this._filtreManager.updateFiltre();
            this._directionOptions = this._filtreManager.directionOptions;
            this._serviceOptions = this._filtreManager.serviceOptions;
            this._etablissementOptions = this._filtreManager.etablissementOptions;
        } else {
            this._filtreRessMatManager.updateFiltre();
        }
        
        //this.updateRessourceFiltre();
    }

    updateRessourceFiltre() {

        if(this.isRessHum){
            this._ressourceManager.filtreManager = this._filtreManager;
            this._ressourceManager._filtreRessExtManager = this._filtreRessExtManager;
            this._ressourceManager.updateRessourceOption();
            if(this.isRessExt){
                this._ressourceAff = this._ressourceManager.ressourceExtOptions;
            } else {
                this._ressourceAff = this._ressourceManager.ressourceOptions;
            }
        } else {
            this._ressourceMatManager.filtreManager = this._filtreRessMatManager;
            this._ressourceMatManager.updateRessourceOption();
            this._ressourceAff = this._ressourceMatManager.ressourceOptions;
        }
        
        this.refreshAffectations();
    }

    handleChangeRessourceType(event) {
        let labelRessType = '' ;
        const selectedOption = event.detail.value;
        
        this./*_filtreManager.*/ressourceTypeOptions.forEach((row) => {
            //console.log('row : '+JSON.stringify(row));
            if(row.value === selectedOption){
                labelRessType = row.label ;
            }

        });

        //alert('You choose id = '+selectedOption+' / name = '+labelRessType);

        if(selectedOption === "ressMat"){
            this.isRessHum = false ;
            this.isRessExt = false ;
            this._ressourceManager.isRessHum = false ;
            this._ressourceManager.isRessExt = false ;
            this._ressourceAff = this._ressourceMatManager.ressourceOptions;
        } else if(labelRessType === "Externe"){
            this.isRessHum = true ;
            this.isRessExt = true ;
            this._ressourceManager.isRessHum = true ;
            this._ressourceManager.isRessExt = true ;
            //this._ressourceManager.updateRessourceOption();
            this._ressourceAff = this._ressourceManager.ressourceExtOptions;
            //this.updateAllFiltreOption();
        } else if(labelRessType === "Salarié"){
            this.isRessHum = true ;
            this.isRessExt = false ;
            this._ressourceManager.isRessHum = true ;
            this._ressourceManager.isRessExt = false ;
            //this._ressourceManager.updateRessourceOption();
            this._ressourceAff = this._ressourceManager.ressourceOptions;
            //this.updateAllFiltreOption();
        }

        console.log('YGT 21 10 ressType selected : '+selectedOption);

        this._filtreManager.currentRessourceType = selectedOption;
        this._currentRessourceType = selectedOption;

        console.log('YGT 21 10 this._filtreManager.currentRessourceType : '+this._filtreManager.currentRessourceType);

        
        //this.updateAllFiltreOption();
    }

    handleChangeFonction(event) {
        this._filtreManager.currentFonction = event.detail.value;
        this.updateAllFiltreOption();
    }

    handleChangeSociete(event) {
        if(this.isRessHum)
            this._filtreManager.currentSociete = event.detail.value;
        else
            this._filtreRessMatManager.currentSociete = event.detail.value;

        this.updateAllFiltreOption();
    }

    handleChangeDirection(event) {
        this._filtreManager.currentDirection = event.detail.value;
        this.updateAllFiltreOption();
    }

    handleChangeService(event) {
        this._filtreManager.currentService = event.detail.value;
        this.updateAllFiltreOption();
    }

    handleChangeEtablissement(event) {
        if(this.isRessHum)
            this._filtreManager.currentEtablissement = event.detail.value;
        else
            this._filtreRessMatManager.currentEtablissement = event.detail.value;

        this.updateAllFiltreOption();
    }

    handleChangeMatType(event) {
        this._filtreRessMatManager.currentMaterialType = event.detail.value;
        this.updateAllFiltreOption();
    }

    handleChangeTiers(event) {
        this._filtreRessExtManager.currentTiers = event.detail.value;
        this.updateAllFiltreOption();
    }

    renderedCallback() {
        console.log("COMPONENT RERENDERD");
    }

    @wire(getJourFerie) jourFerie(value) {
        const { data, error } = value;
        if (data) {
            this._jourFerie = data;
        } else if (error) {
            window.console.error(error);
        }
    }

    @wire(getMaterialTypes) materialTypes(value) {
        const { data, error } = value;

        if (data) {
            let currentData = [];
            currentData.push(
                new Fonction(
                    "allTypes",
                    "Tous les Types"
                )
            );
            data.forEach((row) => {
                currentData.push(new RessourceType(row.Id, row.Name));
            });

            this._filtreRessMatManager.currentMaterialType = "allTypes";
            this._filtreRessMatManager.allTypeOptions = currentData;
            this._filtreRessMatManager.initMaterialTypeOptions();
            //this._ressourceTypeOptions = this._filtreManager.ressourceTypeOptions;

        } else if (error) {
            console.error('YGT error '+error);
        }
    }

    @wire(getRessourceTypes) ressourceTypes(value) {
        const { data, error } = value;

        if (data) {
            let currentData = [];
            data.forEach((row) => {
                currentData.push(new RessourceType(row.Id, row.Name));
                if(row.Name === "Salarié"){
                    this.idSalarie = row.Id ;
                }

            });

            currentData.push(new RessourceType("ressMat", "Matériel"));

            this._filtreManager.currentRessourceType = this.idSalarie;
            this._currentRessourceType = this.idSalarie;
            this._filtreManager.allRessourceTypeOptions = currentData;
            this._filtreManager.initRessourceTypeOptions();
            this._ressourceTypeOptions = this._filtreManager.ressourceTypeOptions;
            console.log('YGT 21 10 all RessourceType : '+JSON.stringify(currentData));

        } else if (error) {
            console.error('YGT error '+error);
        }
    }

    @wire(getFonctions) fonctions(value) {
        const { data, error } = value;
        if (data) {
            let currentData = [];
            currentData.push(
                new Fonction(
                    "allFonctions",
                    "Toutes les Fonctions"
                )
            );
            data.forEach((row) => {
                currentData.push(new Fonction(row.value, row.label));
            });
            this._filtreManager.currentFonction = "allFonctions";
            this._filtreManager.allFonctionOptions = currentData;
            this._filtreManager.initFonctionOptions();
            this._fonctionOptions = this._filtreManager.fonctionOptions;

        } else if (error) {
            console.error('YGT error '+error);
        }
    }

    @wire(getAllSocietes) societes(value) {
        const { data, error } = value;
        if (data) {
            let currentData = [];
            currentData.push(new Societe("allSocietes", "Toutes les Sociétés"));
            data.forEach((row) => {
                currentData.push(new Societe(row.Id, row.Name));
            });
            this._filtreManager.currentSociete = "allSocietes";
            this._filtreManager.allSocieteOptions = currentData;
            this._filtreManager.initSocieteOptions();

            this._filtreRessMatManager.currentSociete = "allSocietes";
            this._filtreRessMatManager.allSocieteOptions = currentData;
            this._filtreRessMatManager.initSocieteOptions();

            this._societeOptions = this._filtreManager.societeOptions;
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getAllDirections) directions(value) {
        const { data, error } = value;
        if (data) {
            let currentData = [];
            currentData.push(
                new Direction("allDirections", "Toutes les directions")
            );
            data.forEach((row) => {
                currentData.push(
                    new Direction(row.Id, row.Name, row.Societe__c)
                );
            });
            this._filtreManager.currentDirection = "allDirections";
            this._filtreManager.allDirectionOptions = currentData;
            this._filtreManager.initDirectionOptions();
            this._directionOptions = this._filtreManager.directionOptions;
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getAllDirectionsServices) directionsServices(value) {
        const { data, error } = value;
        if (data) {
            let currentData = [];
            data.forEach((row) => {
                currentData.push(
                    new DirectionService(
                        row.Id,
                        row.Direction__c,
                        row.Direction__r.Name,
                        row.Service__c,
                        row.Service__r.Name
                    )
                );
            });
            this._filtreManager.allDirectionsServices = currentData;
            this._filtreManager.initDirectionServiceOptions();
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getAllServices) service(value) {
        const { data, error } = value;
        if (data) {
            let currentData = [];
            currentData.push(new Service("allServices", "Tous les services"));
            data.forEach((row) => {
                currentData.push(new Service(row.Id, row.Name));
            });
            this._filtreManager.currentService = "allServices";
            this._filtreManager.allServiceOptions = currentData;
            this._filtreManager.initServiceOptions();
            this._serviceOptions = this._filtreManager.serviceOptions;
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getAllEtablissements) etablissement(value) {
        const { data, error } = value;
        if (data) {
            let currentData = [];
            currentData.push(
                new Etablissement(
                    "allEtablissements",
                    "Tous les Etablissements"
                )
            );
            data.forEach((row) => {
                currentData.push(new Etablissement(row.Id, row.Name));
            });
            this._filtreManager.currentEtablissement = "allEtablissements";
            this._filtreManager.allEtablissementOptions = currentData;
            this._filtreManager.initEtablissementOptions();

            this._filtreRessMatManager.currentEtablissement = "allEtablissements";
            this._filtreRessMatManager.allEtablissementOptions = currentData;
            this._filtreRessMatManager.initEtablissementOptions();

            this._etablissementOptions = this._filtreManager.etablissementOptions;
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getAllSocietesEtablissements) societesEtablissements(value) {
        const { data, error } = value;
        if (data) {
            let currentData = [];
            data.forEach((row) => {
                currentData.push(
                    new SocieteEtablissement(
                        row.Id,
                        row.Societe__c,
                        row.Societe__r.Name,
                        row.Etablissement__c,
                        row.Etablissement__r.Name
                    )
                );
            });
            this._filtreManager.allSocietesEtablissements = currentData;
            this._filtreManager.initSocieteEtablissementOptions();

            this._filtreRessMatManager.allSocietesEtablissements = currentData;
            this._filtreRessMatManager.initSocieteEtablissementOptions();
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getTiers) tiers(value) {
        const { data, error } = value;
        if (data) {
            let currentData = [];
            currentData.push(
                new Tiers(
                    "allTiers",
                    "Tous les tiers"
                )
            );
            data.forEach((row) => {
                currentData.push(new Tiers(row.Tiers__c, row.Tiers__r.Name));
            });
            this._filtreRessExtManager.currentTiers = "allTiers";
            this._filtreRessExtManager.allTiersOptions = currentData;
            this._filtreRessExtManager.initTiersFiltre();
            this._clientOptions = this._filtreRessExtManager.tiersOptions;
            //this._filtreRessExtManager.allTiersOptions = currentData;

        } else if (error) {
            console.error('YGT error '+error);
        }
    }

    @wire(getAllRessourcesHumaines)
    ressource(value) {
        this.ressourceMonth = value;
        const { data, error } = value;

        if (data) {
            let currentData = [];
            let modelCalendar = "";
            let ressourceIncluded = [];
            let currentDataWithMultiPostes = [];

            data.forEach((row) => {

                if (row.hasOwnProperty("CalendrierModele__c") === true) {
                    modelCalendar = row.CalendrierModele__c;
                }
                else{
                    modelCalendar = "";
                }

                if (row.hasOwnProperty("Postes_Carriere__r") === true) {
                    row.Postes_Carriere__r.forEach((poste) => {
                        if(ressourceIncluded.includes(row.Id)){
                            currentDataWithMultiPostes.push(
                                new Ressource(
                                row.Id,
                                row.Name,
                                poste.DirectionService__c,
                                poste.DirectionService__r.Direction__c,
                                poste.DirectionService__r.Service__c,
                                poste.Fonction__c,
                                poste.Etablissement__c,
                                poste.ContratRH__r.Societe__c,
                                modelCalendar, //row.CalendrierModele__c,
                                this._calendar,
                                row.RecordTypeId,
                                row.RecordType.Name,
                                row.Tiers__c
                                )
                            );
                        }
                        else{
                            currentData.push(
                                new Ressource(
                                row.Id,
                                row.Name,
                                poste.DirectionService__c,
                                poste.DirectionService__r.Direction__c,
                                poste.DirectionService__r.Service__c,
                                poste.Fonction__c,
                                poste.Etablissement__c,
                                poste.ContratRH__r.Societe__c,
                                modelCalendar, //row.CalendrierModele__c,
                                this._calendar,
                                row.RecordTypeId,
                                row.RecordType.Name,
                                row.Tiers__c
                                )
                            );
                            currentDataWithMultiPostes.push(
                                new Ressource(
                                row.Id,
                                row.Name,
                                poste.DirectionService__c,
                                poste.DirectionService__r.Direction__c,
                                poste.DirectionService__r.Service__c,
                                poste.Fonction__c,
                                poste.Etablissement__c,
                                poste.ContratRH__r.Societe__c,
                                modelCalendar, //row.CalendrierModele__c,
                                this._calendar,
                                row.RecordTypeId,
                                row.RecordType.Name,
                                row.Tiers__c
                                )
                            );
                            ressourceIncluded.push(row.Id);
                        }
                    });
                }

                /****** old version *******/
                /*if (row.hasOwnProperty("CalendrierModele__c") === true) {
                    row.Postes_Carriere__r.forEach((poste) => {
                        currentData.push(
                            new Ressource(
                                row.Id,
                                row.Name,
                                poste.DirectionService__c,
                                poste.DirectionService__r.Direction__c,
                                poste.DirectionService__r.Service__c,
                                poste.Fonction__c,
                                poste.Etablissement__c,
                                poste.ContratRH__r.Societe__c,
                                row.CalendrierModele__c,
                                this._calendar,
                                row.RecordTypeId,
                                row.RecordType.Name,
                                row.Tiers__c
                            )
                        );
                    });
                } else {
                    currentData.push(
                        new Ressource(
                            row.RessourceHumaine__c,
                            row.Name,
                            poste.DirectionService__c,
                            poste.DirectionService__r.Direction__c,
                            poste.DirectionService__r.Service__c,
                            poste.Fonction__c,
                            row.Etablissement__c,
                            row.Societe__c,
                            "",
                            this._calendar,
                            row.RecordTypeId,
                            row.RecordType.Name,
                            row.Tiers__c
                        )
                    );
                }
                /*******************************/
            });
            this._ressourceAff = currentData;
            this._ressourceManager.allRessources = currentDataWithMultiPostes;
            this._ressourceManager.initressourceOptions();
            //this.refreshAffectations();
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getAllRessourcesMaterielles)
    ressourceMat(value) {
        this.ressourceMonth = value;
        const { data, error } = value;

        if (data) {
            let currentData = [];

            data.forEach((row) => {

                if (row.hasOwnProperty("CalendrierModele__c") === true) {
                        currentData.push(
                            new RessourceMaterielle(
                                row.Id,
                                row.Name,
                                row.Etablissement__c,
                                row.Societe__c,
                                row.RecordTypeId,
                                row.RecordType.Name,
                                row.CalendrierModele__c,
                                this._calendar
                            )
                        );
                } else {
                    currentData.push(
                        new RessourceMaterielle(
                            row.Id,
                            row.Name,
                            row.Etablissement__c,
                            row.Societe__c,
                            row.RecordTypeId,
                            row.RecordType.Name,
                            "",
                            this._calendar
                        )
                    );
                }
            });
            //this._ressourceAff = currentData;
            this._ressourceMatManager.allRessources = currentData;
            this._ressourceMatManager.initressourceOptions();
            //this.refreshAffectations();
        } else if (error) {
            console.error(error);
        }
    }

    @wire(getAllRessourcesExternes)
    ressourceExt(value) {
        this.ressourceMonth = value;
        const { data, error } = value;

        if (data) {
            let currentData = [];
            let modelCalendar = "";

            data.forEach((row) => {
                console.log("YGT ress Ext : "+JSON.stringify(row));
                if (row.hasOwnProperty("CalendrierModele__c") === true) {
                    modelCalendar = row.CalendrierModele__c;
                }
                else{
                    modelCalendar = "";
                }
                currentData.push(
                        new Ressource(
                            row.Id,
                            row.Name,
                            "", //poste.DirectionService__c,
                            "", //poste.DirectionService__r.Direction__c,
                            "", //poste.DirectionService__r.Service__c,
                            "", //poste.Fonction__c,
                            "", //poste.Etablissement__c,
                            "", //poste.ContratRH__r.Societe__c,
                            modelCalendar, //row.CalendrierModele__c,
                            this._calendar,
                            row.RecordTypeId,
                            row.RecordType.Name,
                            row.Tiers__c
                        )
                    );
            });
            //this._ressourceAff = currentData;
            this._ressourceManager.allRessourcesExt = currentData;
            this._ressourceManager.initressourceExtOptions();
            //this.refreshAffectations();
        } else if (error) {
            console.error(error);
        }
    }

    refreshAffectations = async () => {
        console.log("YGT refreshAffectations");
        // FMethode async de recuperation des afffectations
        try {
            console.log("YGT getAffectationsByDates");

            //console.log("YGT this._startDate : "+new Intl.DateTimeFormat(LOCALE).format(this._startDate));
            //console.log("YGT this._endDate : "+new Intl.DateTimeFormat(LOCALE).format(this._endDate));

            //let resultatPromise = await getAffectations(); //appel imperatif à au controlleur apex

            let resultatPromise = await getAffectationsByDates({
                        startDateStr: new Intl.DateTimeFormat(LOCALE).format(this._startDate), 
                        endDateStr: new Intl.DateTimeFormat(LOCALE).format(this._endDate)
                    }); //appel imperatif à au controlleur apex

            //console.log("YGT end of getAffectationsByDates");
            //console.log(resultatPromise);
            console.log('MNL this._ressourceAff:'+ JSON.stringify(this._ressourceAff, null, 2));
            this._ressourceAff.forEach((Element) => {
                console.log("YGT 2308 Element :", Element.ressourceId, Element);
                //pour chaque ressources récup auparavant avec le @wire getRessources
                Element.calendar = this._calendar; //on reset le calendar de chaque ressources (tres utile quand les dates sélectonnées changent)
                //console.log(Object.entries(this._jourFerie));
                if (Element.calendarModel === "") {
                    Element.calendar.jourInactif(
                        Object.entries(this._jourFerie)[0][1]
                    );
                } else {
                    Element.calendar.jourInactif(
                        Object.entries(this._jourFerie).find(
                            (key1) => key1[0] === Element.calendarModel
                        )[1]
                    );
                }
                //console.log(Object.entries(this._jourFerie).find(key1 => key1[0] === Element.calendarModel));
                let maxAffectation = 0;
                Element.calendar.periode.forEach((day) => {
                     //console.log("YGT 2308 day:", day);
                    //iterate on periode plan for every ressource

                    //if (day.actif === true) { //Si le jour est actif (pas un week end)

                    let affectations = []; //tmp array for affectation
                    resultatPromise.forEach((row) => {
                         /*console.log(
                             "YGT 2308 affectation :",
                             row.RessourceHumaine__c,
                             row
                         );*/
                        //iterate on all affecation get by apex controller

                        if (
                            Element.ressourceId === row.RessourceHumaine__c || Element.ressourceId === row.RessourceMaterielle__c
                        ) {
                            console.log("It's a match");
                            //if id ressource match with id ressource from affecation we continue
                            let affectation = {};
                            if (
                                row.hasOwnProperty("DateDeDebut__c") ===
                                    true &&
                                row.hasOwnProperty("DateDeFin__c") ===
                                    true
                            ) {
                                affectation = new Affectation(
                                    row.Id,
                                    row.RecordType.DeveloperName,
                                    row.DateDeDebut__c,
                                    row.DateDeFin__c,
                                    row.hasOwnProperty("Titre__c")
                                        ? row.Titre__c
                                        : "",
                                    row.CodeCouleur__c,
                                    row.Lieu__c,
                                    row.Validation__c,
                                    row.hasOwnProperty("Tiers__r")
                                        ? row.Tiers__r.Name
                                        : "non définie",
                                    row.hasOwnProperty("Affaire__r")
                                        ? row.Affaire__r.Name
                                        : "non définie",
                                    row.hasOwnProperty("Tache__r")
                                        ? row.Tache__r.Name
                                        : "non définie",
                                    row.hasOwnProperty("NombreJours__c")
                                        ? row.NombreJours__c
                                        : "non définie",
                                    row.hasOwnProperty(
                                        "NombreJours__c"
                                    ) && row.hasOwnProperty("Affaire__r")
                                        ? row.Affaire__r
                                              .UnitDeFacturation__c
                                        : "non définie"
                                );

                                let startDateTmp = new Date(
                                    affectation.startDate.valueOf()
                                );
                                startDateTmp.setHours(0, 0, 0, 0);
                                let endDateTmp = new Date(
                                    affectation.endDate.valueOf()
                                );
                                endDateTmp.setHours(0, 0, 0, 0);

                                //on test si la date de l'affectation math parfaitement avec le jour du calendar sélectionné

                                if (
                                    day.dateObject >= startDateTmp &&
                                    day.dateObject <= endDateTmp
                                ) {
                                    affectations.push(affectation);
                                }
                            }
                        }
                    });
                    if (affectations.length > 0) {
                        //console.log(affectations);
                        affectations.sort((aff1, aff2) => {
                            let returnvalue;
                            if (
                                aff1.startDate.getTime() <
                                aff2.startDate.getTime()
                            ) {
                                returnvalue = -1;
                            } else if (
                                aff1.startDate.getTime() >
                                aff2.startDate.getTime()
                            ) {
                                returnvalue = 1;
                            }
                            return returnvalue;
                        });
                        //console.log(affectations);
                    }

                    day.affectations = affectations;
                    if (maxAffectation < day.affectations.length) {
                        maxAffectation = day.affectations.length;
                    }
                    //}
                });
                Element.calendar.maxAffectation = `min-height:1.75rem;height: ${
                    maxAffectation * 1.2
                }rem;`; //permet l'affichage dynamique de la hauteur des lignes
            });
            console.log("Fin");
            this._reload = this._reload + 1;
        } catch (error) {
            console.log("YGT getAffectationsByDates ERROR", error);
            console.log("YGT getAffectationsByDates ERROR", error.message);
            console.log(JSON.stringify(error));
            this.error = error;
        }
    };

    // print() {
    //     //juste là pour afficher les données avec un bouton de la page dans la console va disparaitre à terme
    //     console.log(this._ressourceAff);
    //     this._ressourceAff[0].calendar.periode.forEach((periode) => {
    //         console.log(periode.affectations);
    //     });
    //     console.log(this.refreshAffectations);
    //     console.log(this._jourFerie);
    // }

    handleDragOver(evt) {
        evt.preventDefault();
    }

    handleListAffectationDrag(event) {
        //console.log('handleListAffectationDrag event : '+JSON.stringify(event));
        //console.log('handleListAffectationDrag event.detail : '+JSON.stringify(event.detail));
        this._draggingAffectation = event.detail; //on stock les données de l'event drag dans un attribut
    }

    handleAffectationDrop(event) {
        console.log('KIL - handleAffectationDrop event : '+JSON.stringify(event));
        console.log('KIL - handleAffectationDrop event.detail : '+JSON.stringify(event.detail));

        let newDateRessource = event.detail;

        let startDate = new Date(
            newDateRessource.year,
            newDateRessource.month,
            newDateRessource.date
        ); //creation de la nouvelle date de départ à partir de la case visé
        if (startDate.getDay() !== 0 && startDate.getDay() !== 6) {
            //on ne procède au drop que si le case n'est ni un samedi ni un dimanche
            let endDate = new Date(startDate.valueOf()); //on copie simplement la date de départ en date de fin

            startDate.setHours(this._draggingAffectation.startDate.getHours()); //recuperation des horraires startDate de l'affectations de départ
            startDate.setMinutes(
                this._draggingAffectation.startDate.getMinutes()
            );
            startDate.setSeconds(
                this._draggingAffectation.startDate.getSeconds()
            );

            let tmp = Calendar.dateDiffDay(
                this._draggingAffectation.startDate,
                this._draggingAffectation.endDate
            );
            //recuperation de la durée de la tâche en jour -1
            endDate.setDate(endDate.getDate() + tmp); //décalage de la nouvelle date de fin en fonction de la durée de l'affectation
            endDate.setHours(this._draggingAffectation.endDate.getHours()); //recuperation des horraires endDate de l'affectations de départ
            endDate.setMinutes(this._draggingAffectation.endDate.getMinutes());
            endDate.setSeconds(this._draggingAffectation.endDate.getSeconds());

            /*this.updateAffectation(
                this._draggingAffectation.id,
                startDate,
                endDate,
                newDateRessource.ressourceId
            ); //lancement de l'update de l'affectation*/
            this.recalculEndDate(
                this._draggingAffectation.id,
                startDate,
                newDateRessource.ressourceId
            ); //lancement du recalcul de la date de fin
            
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: "Erreur",
                    message:
                        "Vous ne pouvez pas réaffecter une tâche sur un weekEnd",
                    variant: "error"
                })
            );
        }
    }

    recalculEndDate(id, startDate, idRessource){
        let parameters = {
            affId: id,
            ressId: idRessource,
            startDate: startDate
        };
    
        reCalculateEndDateTimeAfterDragDrop(parameters)
            .then((results) => {
                let endDate = new Date(results);
                this.updateAffectation(
                    id,
                    startDate,
                    endDate,
                    idRessource
                ); //lancement de l'update de l'affectation
            })
    }

    

    updateAffectation(id, startDate, endDate, idRessource) {

        console.log('updateAffectation id : '+id);
        console.log('updateAffectation idRessource : '+idRessource);
        console.log('updateAffectation startDate : '+startDate);
        console.log('updateAffectation endDate : '+endDate);

        // Create the recordInput object
        const fields = {};
        fields[AFFECTATIONS_ID.fieldApiName] = id;
        fields[AFFECTATIONS_START_DATE.fieldApiName] = startDate.toISOString();
        fields[AFFECTATIONS_END_DATE.fieldApiName] = endDate.toISOString();
        fields[AFFECTATIONS_RESSOURCES.fieldApiName] = idRessource;

        const recordInput = { fields };

        updateRecord(recordInput)
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: "Success",
                        message: "affectation mise à jour",
                        variant: "success"
                    })
                );
                this._ressourceAff.forEach((Element) => {
                    Element.calendar = this._calendar;
                });
                this.refreshAffectations(); //on rapelle le serveur pour recupérer les affectations maj
            })
            .catch((error) => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: "Erreur lors de la mise à jour de l'affectation",
                        message: error.body.message,
                        variant: "error"
                    })
                );
            });
    }

    closeModal() {
        // console.log("calendarPrototypes2Modulaire closeModal");
        let modal = this.template.querySelector(`[data-id="lwcAffectation"]`);
        modal.classList.remove("slds-fade-in-open");
        let backdrop = this.template.querySelector(`[data-id="backdrop"]`);
        backdrop.classList.remove("slds-backdrop--open");
    }

    openModal() {
        // console.log("calendarPrototypes2Modulaire openModal");
        let modal = this.template.querySelector(`[data-id="lwcAffectation"]`);
        modal.classList.add("slds-fade-in-open");
        let backdrop = this.template.querySelector(`[data-id="backdrop"]`);
        backdrop.classList.add("slds-backdrop--open");
    }

    stopPropagation(event) {
        event.stopPropagation();
    }

    goToUrl(url) {
        this[NavigationMixin.Navigate]({
            type: "standard__webPage",
            attributes: {
                url: url
            }
        });
    }

    closeModalAndGoToUrl(event) {
        let url = event.target.recordUrl;
        this.closeModal();
        if (url) this.goToUrl(url);
    }

    handleDayCliked(event) {
        console.log("Day clicked !");
        
        console.log("event.target.date : "+event.target.date);
        console.log("event.target.month : "+event.target.month);
        console.log("event.target.year : "+event.target.year);
        console.log("event.target.ressourceId : "+event.target.ressourceId);

        console.log('YGT 21 10 JSON event : '+JSON.stringify(this._currentRessourceType));
        console.log('YGT 21 10 event : '+this._currentRessourceType);

        this._clickedDayDate = event.target.date;
        this._clickedDayMonth = event.target.month;
        this._clickedDayYear = event.target.year;
        this._clickedDayRHId = event.target.ressourceId;

        this.openModal();
    }
}
