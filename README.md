# Typescript Dependency Injector Manager

Very small dependency injection manager which doesn't use the common pattern
of injecting the dependencies via constructor and which also does not require
a factory when instantiating a class annotated with `Service`.

## Installation

```
npm install --save tsdim
```

## Usage

### Simple, direct injection

```
import {Service, Autowired} from 'tsdim';

@Service()
class ServiceA {
}

@Service()
class ServiceB {
    @Autowired(ServiceA) public a: ServiceA;
}

// No need of factories, or anything else.
const b = new ServiceB();
console.log('b.a is instantiated', b.a);
```

### Injection tokens

```
import {Service, Autowired} from 'tsdim';

@Service('service-a')
class ServiceA {
}

@Service()
class ServiceB {
    @Autowired('service-a') public a: ServiceA;
}

// No need of factories, or anything else.
const b = new ServiceB();
console.log('b.a is instantiated', b.a);
```

### Changing a service implementation:

```
import {Service, Autowired} from 'tsdim';

@Service()
class ServiceA {
}

@Service()
class ServiceB {
    @Autowired(ServiceA) public a: ServiceA;
}

class ServiceC {
}

Injector.provide({provide: ServiceA, useClass: ServiceC});

// No need of factories, or anything else.
const b = new ServiceB();
console.log('b.a is of type ServiceC', b.a instanceof ServiceC); // true
console.log('b.a is not of type ServiceC', b.a instanceof ServiceA); // false
```

### Use factories

```
import {Service, Autowired} from 'tsdim';

@Service()
class ServiceA {
    constructor(private _config: MyConfiguration){}
}

@Service()
class ServiceB {
    @Autowired(ServiceA) private _a: ServiceA;
}

function FactoryA(config: MyConfiguration) {
    return new ServiceA(config);
}

Injector.provide({provide: ServiceA, useFactory: FactoryA, dependencies: [{...config object...}]});

// No need of factories, or anything else.
const b = new ServiceB();
console.log('b.a._config is instantiated and of type MyConfiguration', b.a['_config'] instanceof MyConfiguration); // true
```

If you want to see the rational behind it, then read on.

## Problems with DI using constructors

Injecting dependencies via constructor is very bad for a few reasons:

* We need to know the private dependencies of a service if we need to extend
  it.

* In case we need to instantiate a class provided by a dependency injector
  container via the constructor, we always need a factory. This is why
  `Angular` is using the `ComponentFactoryResolver` service. Because in
  `Angular` components need to be instantiated and destroyed per request (they
  are not singleton) and a Factory is needed to get an instance of a given
  component.

And I know that we are being told that we should not instantiate classes with
new or that we try to avoid extending classes. But there are lots of valid use
cases to instantiate classes manually (see the mentioned case of `Angular`
components) or to extend services or other things otherwise provided by a
dependency injection container.

I've seen lots of code going to some out of the way trying to avoid extending
something because then they would need to provide the private internal
dependencies of the service they were trying to extend.  I've also seen other
code simply giving up and just aquiring the required service and passing it to
the super class. 

## Examples of bad practice

Let's say we have a service playing videos. This service can use several
backends to play videos (for example `vlc` and `mplayer`). This service is
also using another service to get the metadata of the videos. 

And then, depending on some factors (like user input, part in the application
where we are rendering the player etc.) one of those backends will be used.
This is a classical case of declaring an abstract class and then defining it
afterwards. How is this model normally implemented, avoiding extension?

```
@Service()
export class MetadataService {
    public retrieveMetadata(videoId: string): Metadata {
        // ... retrieve the metadata
    }
}

export interface PlayerBackend {
    play(url: string);
}

@Service()
export class VlcBackend implements PlayerBackend {
    public play(url: string){
        // ... play video
    }
}

@Service()
export class MPlayerBackend implements PlayerBackend {
    public play(url: string){
        // ... play video
    }
}

export type BackendType = 'vlc' | 'mplayer';

@Service()
export class VideoService {
    constructor(
        private _metadataService: MetadataService,
        private _vlcBackend: VlcBackend;
        private _mplayerBackend: MPlaterBackend;
    ){}

    public play(videoId: string, byWhat: BackendType) {
        const metadata = this._metadataService.retrieveMetadata(videoId);

        if (byWhat == 'vlc') {
            this._vlcBackend.play(metadata.url);
            return ;
        }

        if (byWhat == 'mplayer') {
            this._mplayerBackend.play(metadata.url);
            return ;
        }

        throw new Error('BACKEND_NOT_IMPLEMENTED');
    }
}

@Service()
export class Consumer {
    constructor(private _videoService: VideoService){}

    public userChooseBackend(): BackendType {
        // ... return the user preferred backend
    }

    public playVideo(videoId: string) {
        this._videoService.play(videoId, this.userChooseBackend());
    }
}
```

Notice that if I would know from the beginning of the application that only
one backend is choosen, then this is another scenario, and in this case I can
just inject that specific backend based on some kind of token, and the
implementation would be much simpler. But in the case I need to choose the
backend at run time, depending on user preferences, then we have to go to a
lot of overhead, just to avoid inheritance. Why we need that? Because, if we
would use inheritance, it would look something like this:

```
export abstract class AbstractVideoService {
    constructor(
        @Inject() private _metadataService: MetadataService,
    ){}

    public abstract play(videoId: string);
}

@Service()
export class VlcBackend extends AbstractVideoService {
    constructor(private _metadataService: MetadataService) {
        super(this._metadataService);
        // ... initialization code here
    }

    public play(videoId: string){
        // ... play the video
    }
}

@Service()
export class MPlayerBackend extends AbstractVideoService {
    constructor(private _metadataService: MetadataService) {
        super(this._metadataService);
        // ... initialization code here
    }

    public play(videoId: string){
        // ... play the video
    }
}

@Service()
export class Consumer {
    private _backends: Map<string, AbstractVideoService> = new Map<string, AbstractVideoService>();
    constructor(private _vlcBackend: VlcBackend, private _mplayerBackend: MPlayerBackend){
        this._backends.set('vlc', this._vlcBackend);
        this._mplayerBackend.set('mplayer', this._mplayerBackend);
    }

    public userChooseBackend(): Backend {
        // ... return the user preferred backend
    }

    public playVideo(videoId: string) {
        this._backends.get(this.userChooseBackend()).play(videoId);
    }
}
```

Notice how in the pure object oriented paradigm, the responsibility of
choosing the backend is completely the concern of the consummer? In the "do
not use inheritance for the sake of not using inheritance" paradigm, this
concern is shared between the service and the consumer. 

But the issue with the inheritance paradigm is that the backend service needs
to know that the video service internally has a dependency on the
`MetadataService`. And of course, it could be 10 dependencies. The problem is
the same. Also, imagine that you need now to extend the Consumer class. And on
top of this, you have 10 possible backends. How would that look?

Of course, this can be modeled in other ways, but this is the main issue of
passing injection tokens in constructor. 

## How else to do dependency injection?

What about the old way `Spring` java framework used to do it? Using the
`Service` and `Autowired` paradigms. 

So, let's consider the above mentioned example. In the inheritance paradigm,
what if we have this:

```
export abstract class AbstractVideoService {
    @Autowired(MetadataService) private _metadataService: MetadataService;
    constructor(){}

    public abstract play(videoId: string);
}

@Service()
export class VlcBackend extends AbstractVideoService {
    constructor() {
        super();
        // ... initialization code here
    }

    public play(videoId: string){
        // ... play the video
    }
}

@Service()
export class MPlayerBackend extends AbstractVideoService {
    constructor() {
        super();
        // ... initialization code here
    }

    public play(videoId: string){
        // ... play the video
    }
}

@Service()
export class Consumer {
    private _backends: Map<string, AbstractVideoService> = new Map<string, AbstractVideoService>();
    @Autowired() private _vlcBackend: VlcBackend;
    @Autowired() private _mplayerBackend: MPlayerBackend

    constructor(){
        this._backends.set('vlc', this._vlcBackend);
        this._mplayerBackend.set('mplayer', this._mplayerBackend);
    }

    public userChooseBackend(): Backend {
        // ... return the user preferred backend
    }

    public playVideo(videoId: string) {
        this._backends.get(this.userChooseBackend()).play(videoId);
    }
}
```

In this example, now the backend can safely inherit the `AbstractVideoService`
without worrying about it's internal dependencies. 

This is what this dependency injection manager proposes: these 2 annotations
(`Autowired` and `Service`). 

For examples, see the first part of this read me.
